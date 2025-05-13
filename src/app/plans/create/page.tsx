"use client"; 

import { Suspense } from 'react';
import { CreatePlanForm } from "@/components/create-plan-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { type PlanStatus } from "@/types";
import { Loader2, Edit, Sparkles } from "lucide-react"; 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from '@/components/ui/skeleton';
import { addHours, formatISO, isValid, parseISO } from 'date-fns';
import { z } from 'zod';
import { planSchema } from '@/lib/schemas';

type PlanFormValues = z.infer<typeof planSchema>;

export type CreatePlanInitialData = {
  name?: string;
  description?: string;
  location?: string;
  city?: string;
  eventTime?: string | null;
  eventType?: string;
  priceRange?: string;
  status?: PlanStatus;
  invitedParticipantUserIds?: string[];
  itinerary?: any[]; // We'll handle the type conversion in the component
  selectedPoint?: { lat: number; lng: number } | null; 
  mapRadiusKm?: number | null;
  planType?: 'single-stop' | 'multi-stop';
  userEnteredCityForStep2?: string; 
};

function CreatePlanPageComponent() {
  const searchParams = useSearchParams();
  const [initialFormValues, setInitialFormValues] = useState<Partial<PlanFormValues> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [planTypeForDisplay, setPlanTypeForDisplay] = useState<'single-stop' | 'multi-stop'>('single-stop');


  useEffect(() => {
    if (searchParams) {
      let finalCity = searchParams.get('city') || undefined;
      const userEnteredCityFromStep1 = searchParams.get('userEnteredCityForStep2');

      const genericCityFallbacks = ["To be determined", "City to be confirmed", "Area around selected point"];
      if ((!finalCity || genericCityFallbacks.includes(finalCity)) && userEnteredCityFromStep1 && !genericCityFallbacks.includes(userEnteredCityFromStep1)) {
          finalCity = userEnteredCityFromStep1;
      }
      
      const planTypeFromParams = searchParams.get('planType') as 'single-stop' | 'multi-stop' || 'single-stop';
      setPlanTypeForDisplay(planTypeFromParams);

      const dataFromAI: CreatePlanInitialData = {
        invitedParticipantUserIds: searchParams.getAll('invitedParticipantUserIds') || [],
        name: searchParams.get('name') || undefined,
        description: searchParams.get('description') || undefined,
        location: searchParams.get('location') || undefined,
        city: finalCity,
        eventType: searchParams.get('eventType') || undefined,
        priceRange: searchParams.get('priceRange') || undefined, 
        planType: planTypeFromParams,
        userEnteredCityForStep2: userEnteredCityFromStep1 || undefined,
      };
      
      const eventTimeParam = searchParams.get('eventTime');
       if (eventTimeParam) {
        try {
            const parsed = parseISO(eventTimeParam);
             if (!isValid(parsed)) { 
                console.warn("Invalid eventTime from searchParams, defaulting to null:", eventTimeParam);
                dataFromAI.eventTime = null; 
            } else {
                dataFromAI.eventTime = parsed.toISOString();
            }
          } catch {
            console.warn("Error parsing eventTime from searchParams, defaulting to null:", eventTimeParam);
            dataFromAI.eventTime = null; 
          }
      } else {
        dataFromAI.eventTime = null; 
      }
      
      let finalItineraryForForm: PlanFormValues['itinerary'] = [];
      const itineraryString = searchParams.get('itinerary');
      if (itineraryString) {
        try {
          const parsedItineraryFromAI = JSON.parse(itineraryString) as any[];
          if (Array.isArray(parsedItineraryFromAI)) {
            finalItineraryForForm = parsedItineraryFromAI.map(aiItem => ({
                id: `ai_itin_${Date.now()}_${Math.random().toString(36).substring(2,7)}`, 
                placeName: aiItem.placeName || "",
                address: aiItem.address || "",
                city: aiItem.city || "",
                description: aiItem.description || "",
                startTime: aiItem.startTime, 
                endTime: aiItem.endTime || undefined, 
                googleMapsImageUrl: aiItem.googleMapsImageUrl || undefined,
                rating: aiItem.rating !== undefined ? Number(aiItem.rating) : null,
                reviewCount: aiItem.reviewCount !== undefined ? Number(aiItem.reviewCount) : null,
                activitySuggestions: Array.isArray(aiItem.activitySuggestions) ? aiItem.activitySuggestions : [],
            }));
          }
        } catch (e) {
          console.error("Failed to parse itinerary from query params:", e);
        }
      }
      
      const mainEventTimeFromAI = dataFromAI.eventTime || new Date(Date.now() + 3600*1000).toISOString(); 
      const parsedMainEventTime = parseISO(mainEventTimeFromAI);
      const validMainEventTime = isValid(parsedMainEventTime) ? parsedMainEventTime : new Date(Date.now() + 3600*1000);


      if (dataFromAI.location && (!finalItineraryForForm || finalItineraryForForm.length === 0)) {
          finalItineraryForForm = [{
              id: `initial_main_loc_${Date.now()}`,
              placeName: dataFromAI.location,
              address: dataFromAI.location, 
              city: dataFromAI.city || "",
              startTime: formatISO(validMainEventTime),
              endTime: formatISO(addHours(validMainEventTime, 2)),
              description: "Main event starting point.",
              googleMapsImageUrl: `https://picsum.photos/seed/${encodeURIComponent(dataFromAI.location)}/600/450`,
              rating: null,
              reviewCount: null,
              activitySuggestions: [],
          }];
      }
      
      if (finalItineraryForForm && finalItineraryForForm.length > 0) {
          if (dataFromAI.location !== finalItineraryForForm[0].placeName) {
              dataFromAI.location = finalItineraryForForm[0].placeName;
          }
          if (finalCity && !genericCityFallbacks.includes(finalCity)) {
            if (!finalItineraryForForm[0].city || genericCityFallbacks.includes(finalItineraryForForm[0].city)) {
                finalItineraryForForm[0].city = finalCity;
            }
          }

          if (!dataFromAI.eventTime || dataFromAI.eventTime !== finalItineraryForForm[0].startTime) {
            dataFromAI.eventTime = finalItineraryForForm[0].startTime;
          }

      }

      const selectedPointLat = searchParams.get('selectedPointLat');
      const selectedPointLng = searchParams.get('selectedPointLng');
      const mapRadiusKm = searchParams.get('mapRadiusKm');

      if (selectedPointLat && selectedPointLng) {
        dataFromAI.selectedPoint = {
          lat: parseFloat(selectedPointLat),
          lng: parseFloat(selectedPointLng),
        };
      }
      if (mapRadiusKm) {
        dataFromAI.mapRadiusKm = parseFloat(mapRadiusKm);
      }


      const formVals: Partial<PlanFormValues> = {
        name: dataFromAI.name || undefined,
        description: dataFromAI.description || undefined,
        eventTime: dataFromAI.eventTime || undefined, 
        eventType: dataFromAI.eventType || undefined,
        priceRange: dataFromAI.priceRange || undefined,
        invitedParticipantUserIds: dataFromAI.invitedParticipantUserIds || [],
        status: "draft", 
        itinerary: finalItineraryForForm || [],
      };
      setInitialFormValues({ 
        ...formVals, 
        selectedPoint: dataFromAI.selectedPoint || null, 
        mapRadiusKm: dataFromAI.mapRadiusKm || null,
        userEnteredCityForStep2: dataFromAI.userEnteredCityForStep2 || undefined
      });
      setIsLoading(false);
    } else {
        setInitialFormValues({ 
            status: "draft", 
            invitedParticipantUserIds: [], 
            itinerary: [], 
            eventTime: new Date(Date.now() + 3600 * 1000 * 24).toISOString(), 
            planType: 'single-stop' 
        });
        setPlanTypeForDisplay('single-stop');
        setIsLoading(false);
    }
  }, [searchParams]);
  
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Edit className="h-7 w-7 text-primary" />
          Step 2: Review &amp; Refine Your Plan
        </h1>
        <p className="text-muted-foreground">
          Adjust the AI-generated details or complete the plan manually. All fields are required unless marked optional.
          <span className="block mt-1 text-sm">This plan was initiated as a <span className="font-semibold">{planTypeForDisplay === 'single-stop' ? 'Single Stop' : 'Multi-Stop'}</span> event.</span>
        </p>
      </header>
      
      <Card className="w-full max-w-3xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle>Plan Details</CardTitle>
          <CardDescription>
            {initialFormValues && Object.keys(initialFormValues).length > 4 ? // Check if more than just defaults are present
              "Here's the draft generated by AI. Review, edit, and add any missing information. All fields are required unless marked optional." :
              "Let's get planning! Provide as much detail as possible. All fields are required unless marked optional."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || !initialFormValues ? (
             <div className="space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-1/4" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-5 w-1/4" />
                    <Skeleton className="h-20 w-full" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-1/3" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-1/3" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </div>
                 <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <CreatePlanForm 
              initialFormValues={initialFormValues} 
              formMode="create" 
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CreatePlanPage() {
  return (
    <Suspense fallback={ 
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading plan creation tools...</p>
        </div>
    }>
      <CreatePlanPageComponent />
    </Suspense>
  );
}
