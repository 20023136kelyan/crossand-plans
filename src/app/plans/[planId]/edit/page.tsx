
"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPlanById, getParticipantsByPlanId } from "@/lib/actions/plans";
import type { Plan, Participant } from "@/types";
import type { z } from "zod";
import type { planSchema } from "@/lib/schemas";
import { CreatePlanForm } from "@/components/create-plan-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { AlertCircle, Loader2, Edit3, Sparkles } from "lucide-react"; // Added Sparkles
import { Skeleton } from "@/components/ui/skeleton";

type PlanFormValues = z.infer<typeof planSchema>;

function EditPlanDetailsPageComponent() {
  const params = useParams();
  const router = useRouter();
  const planId = params.planId as string;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [initialFormValues, setInitialFormValues] = useState<Partial<PlanFormValues> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) {
      setError("Plan ID is missing.");
      setIsLoading(false);
      return;
    }

    async function fetchData() {
      try {
        setIsLoading(true);
        const planData = await getPlanById(planId);
        if (!planData) {
          setError("Plan not found.");
          setPlan(null);
          setInitialFormValues(null);
          setIsLoading(false);
          return;
        }
        setPlan(planData);

        const participantData = await getParticipantsByPlanId(planId);
        setParticipants(participantData);
        
        // Map Plan data to PlanFormValues
        const formVals: Partial<PlanFormValues> = {
          name: planData.name,
          description: planData.description,
          eventTime: planData.eventTime,
          location: planData.location,
          city: planData.city,
          eventType: planData.eventType,
          priceRange: planData.priceRange,
          status: planData.status,
          invitedParticipantUserIds: participantData.filter(p => p.userId !== planData.hostId).map(p => p.userId),
          itinerary: planData.itinerary?.map(item => ({
            placeName: item.placeName,
            address: item.address,
            city: item.city,
            description: item.description,
            startTime: item.startTime,
            endTime: item.endTime,
            googleMapsImageUrl: item.googleMapsImageUrl,
            rating: item.rating,
            reviewCount: item.reviewCount,
          })) || [],
          // selectedPoint and mapRadiusKm are not typically part of an existing plan's core editable fields directly,
          // unless they were stored with the plan and are meant to be editable.
          // For now, we assume they are not directly edited here.
        };
        setInitialFormValues(formVals);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch plan details:", err);
        setError("Failed to load plan details.");
        setPlan(null);
        setInitialFormValues(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [planId]);

  const handleFormSubmitSuccess = (submittedPlanId: string) => {
    router.push(`/plans/${submittedPlanId}`);
    router.refresh(); // Ensure data is fresh on the details page
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Card className="w-full max-w-3xl mx-auto shadow-lg">
          <CardHeader>
            <Skeleton className="h-8 w-1/3 mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-5 w-1/4" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-5 w-1/4" />
                <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="h-10 w-full mt-4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !plan || !initialFormValues) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-8">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold mb-2">{error || "Plan Not Found"}</h1>
        <p className="text-muted-foreground mb-6">
          {error ? "There was an issue loading the plan." : "The plan you are trying to edit does not exist or may have been removed."}
        </p>
        <Button asChild>
          <Link href="/plans">Go to My Plans</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
         <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Edit3 className="h-7 w-7 text-primary" />
          Edit Plan: <span className="text-primary">{plan.name}</span>
        </h1>
        <p className="text-muted-foreground">
          Modify the details of your plan. Use the <Sparkles className="inline h-4 w-4 text-accent" /> buttons for AI suggestions if needed.
        </p>
      </header>
      
      <Card className="w-full max-w-3xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle>Plan Details</CardTitle>
          <CardDescription>
            Review and update the plan information below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreatePlanForm 
            initialFormValues={initialFormValues}
            formMode="edit"
            planIdForEdit={plan.id}
            onFormSubmitSuccess={handleFormSubmitSuccess}
          />
        </CardContent>
      </Card>
    </div>
  );
}


export default function EditPlanDetailsPage() {
  return (
    // Suspense for useParams hook if needed by Next.js version/config
    <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading editor...</p>
        </div>
    }>
      <EditPlanDetailsPageComponent />
    </Suspense>
  );
}
