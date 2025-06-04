// src/app/p/[planId]/page.tsx - Public Plan View Page
'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from '@/components/ui/separator';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
  Clock,
  ChevronLeft,
  Share2,
  Plus,
  FileText,
  Grid2X2,
  UserCircle
} from "lucide-react";
import { useState, useEffect, useCallback } from 'react';
import type { Plan as PlanType } from '@/types/user';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getGooglePlacePhotoUrl } from '@/utils/googleMapsHelpers';
import { format, parseISO, isValid } from 'date-fns';
import { copyPlanToMyAccountAction, getPublicPlanByIdAction } from '@/app/actions/planActions'; // Updated import
import { VerificationBadge } from '@/components/ui/verification-badge';

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
          mainPlanImage = getGooglePlacePhotoUrl(firstItineraryItemWithImage.googlePhotoReference, 1200, staticMapApiKey);
      } else if (firstItineraryItemWithImage?.googleMapsImageUrl) {
          mainPlanImage = firstItineraryItemWithImage.googleMapsImageUrl;
      }
  }
  const mainPlanImageHint = plan.itinerary?.[0]?.types?.[0] || plan.eventType || 'event scenery';


  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between p-3 bg-background/80 backdrop-blur-sm border-b border-border/30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" onClick={() => router.push('/explore')} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-md font-semibold text-foreground/90 truncate mx-2 flex-1 text-center">{plan.name}</h2>
        <Button variant="ghost" size="icon" onClick={handleCopyToMyPlans} className="text-muted-foreground hover:text-foreground">
          <Share2 className="h-5 w-5" />
        </Button>
      </header>

      {/* Main Content */}
      <Card className="overflow-hidden shadow-xl bg-card/90 border-border/50 rounded-b-xl mt-0!">
        {/* Main Image */}
        <div className="relative w-full h-56 md:h-72 lg:h-80">
          <Image
            src={mainPlanImage}
            alt={plan.name}
            fill
            style={{ objectFit: 'cover' }}
            priority
            unoptimized={mainPlanImage.includes('maps.googleapis.com')}
          />
          {plan.eventType && (
            <div className="absolute top-3 right-3">
              <Badge variant="secondary" className="text-xs sm:text-sm px-2.5 py-1 shadow-md">
                {plan.eventType}
              </Badge>
            </div>
          )}
        </div>

        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-bold text-primary opacity-80">{plan.name}</CardTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground mt-1 text-xs sm:text-sm items-center">
            <div className="flex items-center"><MapPin className="h-4 w-4 mr-1.5" /><span>{plan.location}, {plan.city}</span></div>
            {(plan.averageRating !== null && typeof plan.averageRating === 'number' ) && (
              <div className="flex items-center">
                <Star className="h-4 w-4 mr-1.5 text-amber-400 fill-amber-400" />
                <span>{plan.averageRating.toFixed(1)} ({plan.reviewCount || 0} reviews)</span>
              </div>
            )}
          </div>
          
          {/* Creator Info */}
          <div className="flex items-center mt-2 text-xs text-muted-foreground">
            <Avatar className="h-5 w-5 mr-1.5">
              <AvatarImage src={plan.creatorAvatarUrl || undefined} alt={plan.creatorName || 'Creator'} />
              <AvatarFallback>
                {plan.creatorName?.[0]?.toUpperCase() || <UserCircle className="h-3 w-3"/>}
              </AvatarFallback>
            </Avatar>
            Created by <span className="font-medium text-foreground/80 ml-1">{plan.creatorName}</span>
            <VerificationBadge role={plan.creatorRole} isVerified={plan.creatorIsVerified} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Description */}
          {plan.description && (
            <div>
              <h3 className="font-semibold text-md mb-1.5 flex items-center">
                <FileText className="h-4 w-4 mr-2 text-primary/70"/>Description
              </h3>
              <p className="text-sm text-foreground/80 whitespace-pre-line">{plan.description}</p>
            </div>
          )}
          
          {/* Plan Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            {plan.priceRange && (
              <div className="flex items-start">
                <DollarSign className="h-4 w-4 mr-2 mt-0.5 text-primary/70 shrink-0" />
                <div>
                  <span className="font-medium text-muted-foreground">Price Range: </span>
                  <span className="text-foreground/90">{plan.priceRange}</span>
                </div>
              </div>
            )}
            <div className="flex items-start">
              <Grid2X2 className="h-4 w-4 mr-2 mt-0.5 text-primary/70 shrink-0" />
              <div>
                <span className="font-medium text-muted-foreground">Plan Type: </span>
                <span className="text-foreground/90">{plan.planType === 'single-stop' ? 'Single Stop' : 'Multi-Stop'}</span>
              </div>
            </div>
          </div>

          {/* Itinerary */}
          {plan.itinerary && plan.itinerary.length > 0 && (
            <div>
              <h3 className="font-semibold text-md mb-3 flex items-center">
                <ListChecks className="h-4 w-4 mr-2 text-primary/70" />
                Itinerary ({plan.itinerary.length} stop{plan.itinerary.length !== 1 ? 's' : ''})
              </h3>
              <div className="space-y-4">
                {plan.itinerary.map((item, index) => {
                  let itemPhotoUrl = `https://placehold.co/400x200.png?text=${encodeURIComponent(item.placeName)}`;
                  if (item.googlePhotoReference && staticMapApiKey) {
                    itemPhotoUrl = getGooglePlacePhotoUrl(item.googlePhotoReference, 600, staticMapApiKey);
                  } else if (item.googleMapsImageUrl) {
                    itemPhotoUrl = item.googleMapsImageUrl;
                  }

                  return (
                    <Card key={index} className="overflow-hidden">
                      <div className="grid md:grid-cols-3 gap-3">
                        <div className="relative aspect-[16/9] md:aspect-square bg-muted">
                          <Image
                            src={itemPhotoUrl}
                            alt={item.placeName}
                            fill
                            className="object-cover"
                            unoptimized={itemPhotoUrl.includes('maps.googleapis.com')}
                          />
                        </div>
                        <div className="md:col-span-2 p-3">
                          <h4 className="text-sm font-semibold text-primary/90">
                            {index + 1}. {item.placeName}
                          </h4>
                          {item.address && (
                            <p className="text-xs text-muted-foreground mt-0.5 mb-1">{item.address}</p>
                          )}
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] mt-1.5 text-muted-foreground">
                            {typeof item.rating === 'number' && (
                              <div className="flex items-center">
                                <Star className="w-3 h-3 mr-1 text-amber-400 fill-amber-400"/>
                                {item.rating.toFixed(1)} ({item.reviewCount || 0})
                              </div>
                            )}
                            {item.isOperational !== null && item.isOperational !== undefined && (
                              <Badge variant={item.isOperational ? "default" : "destructive"} className="w-fit py-0.5 px-1.5 text-[10px] bg-opacity-70">
                                {item.isOperational ? <CheckCircle className="w-2.5 h-2.5 mr-1"/> : <XCircle className="w-2.5 h-2.5 mr-1"/>}
                                {item.statusText || (item.isOperational ? "Operational" : "Closed")}
                              </Badge>
                            )}
                            {typeof item.priceLevel === 'number' && (
                              <div>Price: {'$'.repeat(item.priceLevel) || 'N/A'}</div>
                            )}
                            {item.phoneNumber && (
                              <div className="truncate" title={item.phoneNumber}>Phone: {item.phoneNumber}</div>
                            )}
                          </div>
                          
                          {item.activitySuggestions && item.activitySuggestions.length > 0 && (
                            <div className="mt-1.5">
                              <p className="text-[11px] font-medium text-muted-foreground/80 mb-0.5">Suggestions:</p>
                              <ul className="list-disc list-inside pl-1 space-y-0.5">
                                {item.activitySuggestions.map((sugg, i) => (
                                  <li key={i} className="text-xs text-foreground/80">{sugg}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add to My Plans Button */}
          <div className="flex justify-center pt-4">
            <Button
              onClick={handleCopyToMyPlans}
              disabled={isCopyingPlan || !currentUser}
              className="w-full max-w-sm"
            >
              {isCopyingPlan ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {currentUser ? 'Add to My Macaroom' : 'Log in to Add to My Macaroom'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    