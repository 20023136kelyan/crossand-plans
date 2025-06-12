'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Download,
  Share2,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Grid3X3
} from 'lucide-react';
import type { Plan as PlanType } from '@/types/user';
import { getGooglePlacePhotoUrl } from '@/utils/googleMapsHelpers';

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

interface PlanPhotosProps {
  highlights: string[];
  itinerary: ItineraryItem[];
  planName?: string;
  className?: string;
}

export function PlanPhotos({ highlights, itinerary, planName = 'Plan', className }: PlanPhotosProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Collect all photos from the plan
  const allPhotos: { url: string; alt: string; source: string }[] = [];

  // Add photo highlights
  if (highlights?.length) {
    highlights.forEach((photo, index) => {
      allPhotos.push({
        url: photo,
        alt: `Plan highlight ${index + 1}`,
        source: 'highlight'
      });
    });
  }

  // Add itinerary photos
  if (itinerary?.length) {
    itinerary.forEach((item, index) => {
      if (item.googlePhotoReference) {
          // Check if it's already a direct URL (from place-autocomplete)
          const photoUrl = (item.googlePhotoReference.startsWith('http://') || item.googlePhotoReference.startsWith('https://')) 
            ? item.googlePhotoReference 
            : getGooglePlacePhotoUrl(item.googlePhotoReference, 800, 600);
        allPhotos.push({
          url: photoUrl,
          alt: item.placeName,
          source: 'itinerary'
        });
      } else if (item.googleMapsImageUrl) {
        allPhotos.push({
          url: item.googleMapsImageUrl,
          alt: item.placeName,
          source: 'itinerary'
        });
      }
    });
  }

  const openLightbox = (index: number) => {
    setSelectedImageIndex(index);
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    setSelectedImageIndex(null);
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (selectedImageIndex === null) return;
    
    if (direction === 'prev') {
      setSelectedImageIndex(selectedImageIndex > 0 ? selectedImageIndex - 1 : allPhotos.length - 1);
    } else {
      setSelectedImageIndex(selectedImageIndex < allPhotos.length - 1 ? selectedImageIndex + 1 : 0);
    }
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  const shareImage = async (url: string, title: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Photo from ${planName}`,
          text: title,
          url: url
        });
      } catch (error) {
        console.error('Error sharing image:', error);
      }
    } else {
      // Fallback: copy URL to clipboard
      try {
        await navigator.clipboard.writeText(url);
        // You might want to show a toast here
      } catch (error) {
        console.error('Error copying to clipboard:', error);
      }
    }
  };

  if (allPhotos.length === 0) {
    return null;
  }

  return (
    <>
      <Card className={`bg-background/30 backdrop-blur-sm border border-border/30 ${className || ''}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Photo Gallery
          </CardTitle>
          <Badge variant="outline" className="bg-background/50">
            {allPhotos.length} {allPhotos.length === 1 ? 'photo' : 'photos'}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allPhotos.map((photo, index) => (
              <div
                key={index}
                className="relative aspect-square group cursor-pointer overflow-hidden rounded-lg bg-muted"
                onClick={() => openLightbox(index)}
              >
                <Image
                  src={photo.url}
                  alt={photo.alt}
                  fill
                  style={{ objectFit: 'cover' }}
                  className="transition-transform group-hover:scale-105"
                  unoptimized={photo.url.includes('maps.googleapis.com')}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Badge variant="secondary" className="text-xs">
                    {photo.source === 'highlight' ? 'Highlight' : 'Location'}
                  </Badge>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="h-6 w-6 text-white drop-shadow-lg" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lightbox Modal */}
      {isLightboxOpen && selectedImageIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-full w-full h-full flex items-center justify-center">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={closeLightbox}
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Navigation Buttons */}
            {allPhotos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigateImage('prev')}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigateImage('next')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </>
            )}

            {/* Image */}
            <div className="relative w-full h-full max-w-3xl max-h-[80vh]">
              <Image
                src={allPhotos[selectedImageIndex].url}
                alt={allPhotos[selectedImageIndex].alt}
                fill
                style={{ objectFit: 'contain' }}
                className="rounded-lg"
                unoptimized={allPhotos[selectedImageIndex].url.includes('maps.googleapis.com')}
              />
            </div>

            {/* Image Info and Actions */}
            <div className="absolute bottom-4 left-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center justify-between text-white">
                <div>
                  <h3 className="font-semibold">{allPhotos[selectedImageIndex].alt}</h3>
                  <p className="text-sm text-white/80">
                    {selectedImageIndex + 1} of {allPhotos.length} • {allPhotos[selectedImageIndex].source === 'highlight' ? 'Plan Highlight' : 'Location Photo'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadImage(
                      allPhotos[selectedImageIndex].url,
                      `${planName}-${allPhotos[selectedImageIndex].alt}.jpg`
                    )}
                    className="text-white hover:bg-white/20"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => shareImage(
                      allPhotos[selectedImageIndex].url,
                      allPhotos[selectedImageIndex].alt
                    )}
                    className="text-white hover:bg-white/20"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}