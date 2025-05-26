// src/app/p/[planId]/page.tsx - Public Plan View Page
'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from '@/components/ui/separator';
import {
  CalendarDays,
  MapPin,
  Tag,
  DollarSign,
  ListChecks,
  Loader2,
  AlertTriangle,
  CopyPlus,
  LogIn,
  Star,
  CheckCircle,
  XCircle,
  ExternalLink,
  Clock
} from "lucide-react";
import { useState, useEffect, useCallback } from 'react';
import type { Plan as PlanType } from '@/types/user';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
import { copyPlanToMyAccountAction, getPublicPlanByIdAction } from '@/app/actions/planActions'; // Updated import

const MacaronLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M52,22.04C52,14.29,43.71,8,34,8H30C20.29,8,12,14.29,12,22.04a2.5,2.5,0,0,0,0,.27C12,25.25,16.42,30,26,30h12C47.58,30,52,25.25,52,22.31A2.5,2.5,0,0,0,52,22.04Z" />
    <rect x="10" y="30" width="44" height="4" rx="2" ry="2" />
    <path d="M52,41.96C52,49.71,43.71,56,34,56H30C20.29,56,12,49.71,12,41.96a2.5,2.5,0,0,1,0-.27C12,38.75,16.42,34,26,34h12C47.58,34,52,38.75,52,41.69A2.5,2.5,0,0,1,52,41.96Z" />
  </svg>
);

export default function PublicPlanPage() {
  const params = useParams();
  const router = useRouter();
  const searchParamsHook = useSearchParams();
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const planId = params.planId as string;

  const [plan, setPlan] = useState<PlanType | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [clientFormattedEventDateTime, setClientFormattedEventDateTime] = useState<string | null>(null);
  const [isCopyingPlan, setIsCopyingPlan] = useState(false);

  const staticMapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const fetchPlanData = useCallback(async () => {
    if (!planId) {
      setErrorMsg("Plan ID is missing.");
      setPlan(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await getPublicPlanByIdAction(planId);
      if (result.plan) {
        setPlan(result.plan);
      } else if (result.notFound) {
        setPlan(null);
        setErrorMsg(result.error || "Plan not found.");
        toast({ title: "Error", description: result.error || "Plan not found.", variant: "destructive" });
      } else if (result.notPublic) {
        setPlan(null);
        setErrorMsg(result.error || "This plan is not public or has been removed.");
        toast({ title: "Not Public", description: result.error || "This plan is not currently available for public viewing.", variant: "default" });
      } else { // Generic error
        setPlan(null);
        setErrorMsg(result.error || "Failed to load plan details.");
        toast({ title: "Error", description: result.error || "Failed to load plan details.", variant: "destructive" });
      }
    } catch (error: any) { // Catch unexpected client-side errors during the action call itself
      console.error("Error calling getPublicPlanByIdAction:", error);
      setErrorMsg(error.message || "An unexpected error occurred.");
      toast({ title: "Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [planId, toast]);

  useEffect(() => {
    fetchPlanData();
  }, [fetchPlanData]);

  useEffect(() => {
    if (plan?.eventTime) {
      try {
        const dateObj = parseISO(plan.eventTime);
        if (isValid(dateObj)) {
          setClientFormattedEventDateTime(format(dateObj, 'PPPp'));
        } else {
          setClientFormattedEventDateTime("Date not set");
        }
      } catch (e) {
        setClientFormattedEventDateTime("Date not set");
      }
    }
  }, [plan]);

  const handleCopyToMyPlans = useCallback(async () => {
    if (!plan) {
        toast({ title: "Error", description: "No plan loaded to copy.", variant: "destructive" });
        return;
    }
    if (!currentUser) {
      toast({ title: "Login Required", description: "Please log in to add this plan to your Macaroom.", variant: "default" });
      router.push(`/login?redirect=/p/${plan.id}&action=copy&planIdToCopy=${plan.id}`);
      return;
    }
    if (plan.hostId === currentUser.uid) {
      toast({ title: "Already Yours!", description: "This plan is already in your Macaroom. Opening it now...", variant: "default" });
      router.push(`/plans/${plan.id}`);
      return;
    }

    setIsCopyingPlan(true);
    try {
      await currentUser.getIdToken(true); // Force refresh the token
      const idToken = await currentUser.getIdToken(); // Get the (potentially refreshed) token
      const result = await copyPlanToMyAccountAction(plan.id, idToken);
      if (result.success && result.newPlanId) {
        toast({ title: "Plan Copied!", description: `"${plan.name}" has been added to your Macaroom as a new draft.` });
        router.push(`/plans/${result.newPlanId}`);
      } else {
        toast({ title: "Copy Error", description: result.error || "Could not copy the plan.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error copying plan:", error);
      toast({ title: "Error", description: error.message || "An unexpected error occurred while copying.", variant: "destructive" });
    } finally {
      setIsCopyingPlan(false);
    }
  }, [currentUser, plan, router, toast]);


  useEffect(() => {
    if (currentUser && planId && plan && !loading && !authLoading) {
      const action = searchParamsHook.get('action');
      const planIdToCopyFromQuery = searchParamsHook.get('planIdToCopy');
      if (action === 'copy' && planIdToCopyFromQuery === planId) {
        // Only call if not already copying to prevent loops if handleCopyToMyPlans itself causes a state change that re-runs this effect.
        if (!isCopyingPlan) {
            handleCopyToMyPlans();
        }
        // Clean up query params to prevent re-copy on refresh
        router.replace(`/p/${planId}`, { scroll: false });
      }
    }
  }, [currentUser, planId, searchParamsHook, router, plan, loading, authLoading, handleCopyToMyPlans, isCopyingPlan]);

  if (loading || authLoading && !plan) { // Show loader if either main loading or auth is loading and plan isn't set yet
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading plan...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground p-6 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-3xl font-semibold mb-2">{errorMsg || "Plan Not Found"}</h1>
        <p className="text-muted-foreground mb-6">
          {errorMsg ? "The plan could not be loaded." : "The plan you're looking for doesn't exist, has been moved, or is not public."}
        </p>
        <Button asChild variant="outline">
          <Link href="/">Go to Homepage</Link>
        </Button>
      </div>
    );
  }

  let mainPlanImage = `https://placehold.co/1200x600.png?text=${encodeURIComponent(plan.name)}`;
  if (plan.photoHighlights && plan.photoHighlights.length > 0) {
    mainPlanImage = plan.photoHighlights[0];
  } else {
      const firstItineraryItemWithImage = plan.itinerary?.find(item => item.googlePhotoReference || item.googleMapsImageUrl);
      if (firstItineraryItemWithImage?.googlePhotoReference && staticMapApiKey) {
          mainPlanImage = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${firstItineraryItemWithImage.googlePhotoReference}&key=${staticMapApiKey}`;
      } else if (firstItineraryItemWithImage?.googleMapsImageUrl) {
          mainPlanImage = firstItineraryItemWithImage.googleMapsImageUrl;
      }
  }
  const mainPlanImageHint = plan.itinerary?.[0]?.types?.[0] || plan.eventType || 'event scenery';


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="py-4 px-6 border-b border-border/30 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <MacaronLogo className="h-7 w-7 text-primary" />
            <span className="text-2xl font-bold text-primary">Macaroom</span>
          </Link>
          {currentUser ? (
            <Button onClick={handleCopyToMyPlans} disabled={isCopyingPlan || plan.hostId === currentUser.uid} size="sm">
              {isCopyingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CopyPlus className="mr-2 h-4 w-4" />}
              {plan.hostId === currentUser.uid ? "View in My Macaroom" : "Add to My Macaroom"}
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href={`/login?redirect=/p/${plan.id}&action=copy&planIdToCopy=${plan.id}`}>
                <LogIn className="mr-2 h-4 w-4" /> Login to Save
              </Link>
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto max-w-3xl py-8 px-4">
        <div className="relative w-full max-w-2xl mx-auto h-56 md:h-72 lg:h-80 rounded-lg overflow-hidden shadow-lg mb-6 border border-border/30">
          <Image
            src={mainPlanImage}
            alt={plan.name}
            fill
            style={{ objectFit: 'cover' }}
            data-ai-hint={mainPlanImageHint}
            priority
            unoptimized={!mainPlanImage.startsWith('http') || mainPlanImage.includes('placehold.co') || (mainPlanImage.includes('maps.googleapis.com') && !mainPlanImage.includes('photoreference')) || mainPlanImage.includes('firebasestorage.googleapis.com')}
          />
        </div>

        <div className="bg-card p-6 rounded-lg shadow-md border border-border/30">
          <h1 className="text-2xl md:text-3xl font-bold text-primary/90 mb-2">{plan.name}</h1>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground mb-4 text-sm items-center">
            <div className="flex items-center"><CalendarDays className="h-4 w-4 mr-1.5" /><span>{clientFormattedEventDateTime || "Date not set"}</span></div>
            <div className="flex items-center"><MapPin className="h-4 w-4 mr-1.5" /><span>{plan.location}, {plan.city}</span></div>
            {(plan.averageRating !== null && plan.averageRating !== undefined && typeof plan.averageRating === 'number' && isValid(plan.averageRating)) && (
                <div className="flex items-center"><Star className="h-4 w-4 mr-1.5 text-amber-400 fill-amber-400" /><span>{plan.averageRating.toFixed(1)} ({plan.reviewCount || 0} reviews)</span></div>
            )}
          </div>
          
          {plan.eventType && <Badge variant="secondary" className="text-sm mb-4">{plan.eventType}</Badge>}

          <p className="text-foreground/80 whitespace-pre-line mb-6">{plan.description || "No description provided."}</p>
          
          <Separator className="my-6 bg-border/50"/>

          <div>
            <h3 className="font-semibold text-xl mb-4 flex items-center"><ListChecks className="h-5 w-5 mr-2 text-primary" />Itinerary ({plan.itinerary.length} stop{plan.itinerary.length !== 1 ? 's' : ''})</h3>
            {plan.itinerary.length === 0 ? (
              <p className="text-muted-foreground">No itinerary items for this plan.</p>
            ) : (
              <div className="space-y-6">
                {plan.itinerary.map((item, index) => {
                  let itemPhotoUrl = `https://placehold.co/400x200.png?text=${encodeURIComponent(item.placeName)}`;
                   if (item.googlePhotoReference && staticMapApiKey) {
                     itemPhotoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photoreference=${item.googlePhotoReference}&key=${staticMapApiKey}`;
                  } else if (item.googleMapsImageUrl) { 
                    itemPhotoUrl = item.googleMapsImageUrl;
                  }
                  const itemPhotoHint = item.types?.[0] || 'activity location';
                  let itemStartTimeDisplay = 'N/A';
                  let itemEndTimeDisplay = 'N/A';
                  if (item.startTime && isValid(parseISO(item.startTime))) itemStartTimeDisplay = format(parseISO(item.startTime), 'p');
                  if (item.endTime && isValid(parseISO(item.endTime))) itemEndTimeDisplay = format(parseISO(item.endTime), 'p');

                  return (
                    <div key={item.id || index} className="p-4 border border-border/30 rounded-lg bg-background/30 shadow-sm">
                      <h4 className="text-lg font-semibold text-primary/80 mb-1">{index + 1}. {item.placeName}</h4>
                      {item.address && <p className="text-xs text-muted-foreground mt-0.5 mb-1">{item.address}</p>}
                      <p className="text-xs text-muted-foreground mb-1.5">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {itemStartTimeDisplay} - {itemEndTimeDisplay} {item.durationMinutes != null && `(${item.durationMinutes} mins)`}
                      </p>
                      {(item.googlePhotoReference || item.googleMapsImageUrl) && (
                        <div className="relative w-full h-40 rounded-md overflow-hidden my-2 border border-border/20">
                           {itemPhotoUrl.startsWith('https://') ? (
                            <Image 
                                src={itemPhotoUrl} 
                                alt={item.placeName} 
                                fill 
                                style={{objectFit: 'cover'}} 
                                data-ai-hint={itemPhotoHint} 
                                unoptimized={!itemPhotoUrl.startsWith('http') || itemPhotoUrl.includes('placehold.co') || (itemPhotoUrl.includes('maps.googleapis.com') && !itemPhotoUrl.includes('photoreference')) || itemPhotoUrl.includes('firebasestorage.googleapis.com')}
                            />
                            ) : <div className="w-full h-full flex items-center justify-center bg-muted text-xs text-muted-foreground">Invalid image URL</div>
                           }
                        </div>
                      )}
                      {item.description && <p className="text-sm text-foreground/70 mb-2 line-clamp-3">{item.description}</p>}
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-1.5 text-muted-foreground">
                          {typeof item.rating === 'number' && isValid(item.rating) && <div className="flex items-center"><Star className="w-3.5 h-3.5 mr-1 text-amber-400 fill-amber-400"/> {item.rating.toFixed(1)} ({item.reviewCount || 0})</div>}
                          {item.isOperational !== null && item.isOperational !== undefined && (
                              <Badge variant={item.isOperational ? "default" : "destructive"} className="w-fit py-0.5 px-1.5 text-[10px] bg-opacity-70">
                                  {item.isOperational ? <CheckCircle className="w-3 h-3 mr-1"/> : <XCircle className="w-3 h-3 mr-1"/>}
                                  {item.statusText || (item.isOperational ? "Operational" : "Closed")}
                              </Badge>
                          )}
                          {typeof item.priceLevel === 'number' && <div>Price: {'$'.repeat(item.priceLevel) || 'N/A'}</div>}
                          {item.phoneNumber && <div className="truncate" title={item.phoneNumber}>Phone: {item.phoneNumber}</div>}
                      </div>
                      {item.website && <a href={item.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex items-center text-xs mt-1.5">Website <ExternalLink className="w-3 h-3 ml-1"/></a>}

                      {item.activitySuggestions && item.activitySuggestions.length > 0 && (
                        <div className="mt-2">
                            <p className="text-xs font-medium text-muted-foreground mb-0.5">Suggested Activities:</p>
                            <ul className="list-disc list-inside pl-1 space-y-0.5">
                                {item.activitySuggestions.map((sugg, i) => <li key={i} className="text-xs text-foreground/70">{sugg}</li>)}
                            </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
      <footer className="text-center py-8 border-t border-border/30 mt-10">
        <p className="text-xs text-muted-foreground">
          Shared via Macaroom
        </p>
      </footer>
    </div>
  );
}

    