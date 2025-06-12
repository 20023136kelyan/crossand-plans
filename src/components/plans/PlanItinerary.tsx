'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  Star,
  DollarSign,
  Phone,
  Navigation,
  ArrowRight,
  CheckCircle,
  XCircle,
  ListChecks,
  Clock,
  Globe
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
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

interface PlanItineraryProps {
  itinerary: ItineraryItem[];
}

// Helper function to format review counts
const formatReviewCount = (count: number): string => {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return count.toString();
};

// Helper function to format time strings
const formatTime = (timeString: string | null | undefined): string => {
  if (!timeString) return 'N/A';
  try {
    const parsedTime = parseISO(String(timeString));
    if (isValid(parsedTime)) {
      return format(parsedTime, 'p'); // Format as time (e.g., "2:00 PM")
    }
  } catch (error) {
    console.warn('Invalid time format:', timeString);
  }
  return timeString; // Return original if parsing fails
};

export function PlanItinerary({ itinerary }: PlanItineraryProps) {
  if (!itinerary || itinerary.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <ListChecks className="h-6 w-6 text-primary" />
          Itinerary
        </h3>
        <Badge className="bg-black/20 backdrop-blur-sm border-0 text-white px-3 py-1">
          {itinerary.length} {itinerary.length === 1 ? 'stop' : 'stops'}
        </Badge>
      </div>
      
      <div className="space-y-6">
        {itinerary.map((item, index) => {
          let itemPhotoUrl = `https://placehold.co/600x400.png?text=${encodeURIComponent(item.placeName)}`;
          
          if (item.googlePhotoReference) {
            // Check if it's already a direct URL (from place-autocomplete)
            if (item.googlePhotoReference.startsWith('http://') || item.googlePhotoReference.startsWith('https://')) {
              itemPhotoUrl = item.googlePhotoReference;
            } else {
              // Fallback to generating URL from photo reference
              itemPhotoUrl = getGooglePlacePhotoUrl(item.googlePhotoReference, 600, 400);
            }
          } else if (item.googleMapsImageUrl) {
            itemPhotoUrl = item.googleMapsImageUrl;
          }

          return (
            <Card key={index} className="overflow-hidden bg-background/30 backdrop-blur-sm border border-border/30 hover:bg-background/40 transition-all duration-300 hover:shadow-lg">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                {/* Image Section */}
                <div className="relative h-48 lg:h-full lg:col-span-1">
                  <Image
                    src={itemPhotoUrl}
                    alt={item.placeName}
                    fill
                    style={{ objectFit: 'cover' }}
                    unoptimized={itemPhotoUrl.includes('maps.googleapis.com')}
                    onError={(e) => {
                      console.error(`Image failed to load for ${item.placeName}:`, {
                        src: itemPhotoUrl,
                        error: e,
                        googlePhotoReference: item.googlePhotoReference
                      });
                    }}
                  />
                  {/* Step Number Badge */}
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-black/20 backdrop-blur-sm border-0 text-white px-3 py-1.5 text-sm font-bold">
                      Step {index + 1}
                    </Badge>
                  </div>
                  {/* Status Badge */}
                  {item.isOperational !== null && item.isOperational !== undefined && (
                    <>
                      {/* Desktop: Under step number */}
                      <div className="absolute top-16 left-4 hidden lg:block">
                        <Badge 
                          variant={item.isOperational ? "default" : "destructive"} 
                          className="bg-black/20 backdrop-blur-sm border-0 text-white"
                        >
                          {item.isOperational ? (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          {item.statusText || (item.isOperational ? "Open" : "Closed")}
                        </Badge>
                      </div>
                      {/* Mobile: Top right */}
                      <div className="absolute top-4 right-4 lg:hidden">
                        <Badge 
                          variant={item.isOperational ? "default" : "destructive"} 
                          className="bg-black/20 backdrop-blur-sm border-0 text-white"
                        >
                          {item.isOperational ? (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          {item.statusText || (item.isOperational ? "Open" : "Closed")}
                        </Badge>
                      </div>
                    </>
                  )}
                </div>
                
                {/* Content Section */}
                <div className="lg:col-span-2 p-6">
                  <h4 className="text-xl font-bold text-foreground mb-2">
                    {item.placeName}
                  </h4>
                  {item.address && (
                    <div className="flex items-center gap-2 text-muted-foreground mb-4">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm">{item.address}</span>
                    </div>
                  )}
                  
                  {/* Time and Duration */}
                  {(item.startTime || item.endTime || item.durationMinutes) && (
                    <div className="flex items-center gap-2 text-muted-foreground mb-4">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">
                        {item.startTime && item.endTime ? (
                          `${formatTime(item.startTime)} - ${formatTime(item.endTime)}`
                        ) : item.startTime ? (
                          `Starting at ${formatTime(item.startTime)}`
                        ) : item.endTime ? (
                          `Until ${formatTime(item.endTime)}`
                        ) : null}
                        {item.durationMinutes && (
                          <span className="ml-2 text-xs bg-muted px-2 py-1 rounded">
                            {item.durationMinutes >= 60 
                              ? `${Math.floor(item.durationMinutes / 60)}h ${item.durationMinutes % 60}m`
                              : `${item.durationMinutes}m`
                            }
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  
                  {/* Stats Pills */}
                  <div className="flex flex-wrap gap-3 mb-4">
                    {typeof item.rating === 'number' && (
                      <div className="flex items-center gap-2 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 px-3 py-2 rounded-full">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="text-sm font-medium">{item.rating.toFixed(1)}</span>
                        <span className="text-xs opacity-75">({formatReviewCount(item.reviewCount || 0)})</span>
                      </div>
                    )}
                    {typeof item.priceLevel === 'number' && (
                      <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-2 rounded-full">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-sm font-medium">{'$'.repeat(item.priceLevel)}</span>
                      </div>
                    )}
                    {item.phoneNumber && (
                      <a 
                        href={`tel:${item.phoneNumber}`}
                        className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-2 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors cursor-pointer"
                      >
                        <Phone className="h-4 w-4" />
                        <span className="text-sm font-medium">Call</span>
                      </a>
                    )}
                    {item.website && (
                      <a 
                        href={item.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 w-10 h-10 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors cursor-pointer"
                        title="Visit Website"
                      >
                        <Globe className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  
                  {/* User Notes */}
                  {item.notes && (
                    <Card className="bg-gradient-to-br from-muted/50 to-muted/20 border border-muted/30 mt-4">
                      <CardContent className="p-4">
                        <h5 className="text-sm font-semibold text-foreground mb-3">Notes</h5>
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{item.notes}</p>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Activity Suggestions */}
                  {item.activitySuggestions && item.activitySuggestions.length > 0 && (
                    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 mt-4">
                      <CardContent className="p-4">
                        <h5 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <div className="p-1.5 bg-primary/20 rounded-full">
                            <Navigation className="h-3 w-3 text-primary" />
                          </div>
                          Things to Do
                        </h5>
                        <ul className="space-y-2">
                          {item.activitySuggestions.map((suggestion, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm">
                              <div className="p-1 bg-primary/15 rounded-full mt-0.5 shrink-0">
                                <ArrowRight className="h-2.5 w-2.5 text-primary" />
                              </div>
                              <span className="text-foreground/90 leading-relaxed">{suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}