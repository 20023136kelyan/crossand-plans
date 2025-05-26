
'use client'; 

import { PlanForm } from '@/components/plans/PlanForm';
import type { PlanFormValues } from '@/components/plans/PlanForm';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation'; 
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createPlanAction, updatePlanAction, getPlanForEditingAction } from '@/app/actions/planActions';
import type { Plan } from '@/types/user';
import { Loader2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CreateOrEditPlanPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [initialPlanData, setInitialPlanData] = useState<Plan | null>(null);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const editId = searchParams.get('editId');

  const fetchPlanForEditing = useCallback(async () => {
    if (!editId || !user) {
      if (editId && !user) { // Only show error if editId was present but user was not (yet)
        // console.warn("User not available yet for fetching plan.");
        // Potentially, set a state here to retry once user is available, or rely on useEffect's dependency array
      }
      return;
    }

    setIsLoadingInitialData(true);
    setFormMode('edit');
    let idToken: string | null = null;
    try {
      idToken = await user.getIdToken();
      if (!idToken) {
        throw new Error("Authentication token not available.");
      }
    } catch (tokenError: any) {
      toast({ title: "Authentication Error", description: tokenError.message || "Could not get auth token for editing.", variant: "destructive" });
      router.push('/login?redirect=/plans/create'); // Redirect to login, then back to create
      setIsLoadingInitialData(false);
      return;
    }

    try {
      const result = await getPlanForEditingAction(editId, idToken);
      if (result.success && result.plan) {
        setInitialPlanData(result.plan);
      } else if (result.unauthorized) {
        toast({ title: "Unauthorized", description: "You are not authorized to edit this plan.", variant: "destructive" });
        router.push('/plans');
      } else if (result.notFound) {
        toast({ title: "Plan Not Found", description: "The plan you are trying to edit could not be found.", variant: "destructive" });
        router.push('/plans');
      } else {
        toast({ title: "Error Loading Plan", description: result.error || "Could not load plan data.", variant: "destructive" });
        router.push('/plans');
      }
    } catch (err: any) {
      toast({ title: "Error Loading Plan", description: err.message || "An unexpected error occurred.", variant: "destructive" });
      router.push('/plans');
    } finally {
      setIsLoadingInitialData(false);
    }
  }, [editId, user, router, toast]);

  useEffect(() => {
    if (editId && user) { // Ensure user is available before attempting to fetch
      fetchPlanForEditing();
    } else if (!editId) {
      setFormMode('create');
      setInitialPlanData(null);
      setIsLoadingInitialData(false); // Not loading if not editing
    }
    // If editId is present but user is not, this effect will re-run when user becomes available.
  }, [editId, user, fetchPlanForEditing]);

  const handleSubmit = async (data: PlanFormValues) => {
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    let idToken: string | null = null;
    try {
      idToken = await user.getIdToken();
      if (!idToken) throw new Error("Authentication token not available.");
    } catch (tokenError:any) {
      toast({ title: "Authentication Error", description: tokenError.message || "Could not get auth token.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    
    try {
      let result;
      if (formMode === 'edit' && editId) {
        result = await updatePlanAction(editId, data, idToken);
      } else {
        result = await createPlanAction(data, idToken);
      }

      if (result.success) {
        toast({
          title: formMode === 'edit' ? 'Plan Updated!' : 'Plan Created!',
          description: `Your plan "${data.name}" has been successfully saved.`,
        });
        router.push(`/plans/${result.planId || editId}`); 
      } else {
        toast({
          title: `Failed to ${formMode === 'edit' ? 'Update' : 'Create'} Plan`,
          description: result.error || 'An unknown error occurred.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error submitting plan:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while saving the plan.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingInitialData && formMode === 'edit') {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="shrink-0 flex items-center justify-between p-3 border-b border-muted-foreground/50 bg-background/80 backdrop-blur-sm z-20 shadow-sm">
            <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back">
                <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-md font-semibold text-foreground/90">
                {formMode === 'edit' ? 'Edit Plan' : 'Create Plan Manually'}
            </h1>
            <div className="w-9 h-9"></div> {}
        </header>
        <div className="flex-1 overflow-y-auto"> {}
            <PlanForm 
                initialData={initialPlanData} 
                onSubmit={handleSubmit} 
                isSubmitting={isSubmitting} 
                formMode={formMode}
                formTitle={formMode === 'edit' ? 'Edit Your Plan Details' : 'Craft Your Plan Manually'}
            />
        </div>
    </div>
  );
}

