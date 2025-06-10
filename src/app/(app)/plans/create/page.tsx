
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
import { LimitGuard } from '@/components/limits/LimitGuard';
import { cn } from '@/lib/utils';

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

        
        <div className="p-3 text-center">
          <div className="flex items-center justify-center">
            <div className="flex items-center">
              <div
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors relative cursor-pointer",
                  "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => router.push('/plans/generate')}
              >
                AI Generated
              </div>
              <div
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors relative cursor-pointer",
                  "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-full"
                )}
              >
                Manual
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto"> {}
            {formMode === 'create' ? (
                <LimitGuard 
                    type="plan-creation"
                    onLimitReached={() => {
                        toast({
                            title: 'Plan Limit Reached',
                            description: 'You have reached your maximum number of plans. Please delete some existing plans or upgrade your account.',
                            variant: 'destructive',
                        });
                    }}
                >
                    <PlanForm 
                        initialData={initialPlanData} 
                        onSubmit={handleSubmit} 
                        isSubmitting={isSubmitting} 
                        formMode={formMode}
                        formTitle={formMode === 'edit' ? 'Edit Your Plan Details' : 'Craft Your Plan Manually'}
                    />
                </LimitGuard>
            ) : (
                <PlanForm 
                    initialData={initialPlanData} 
                    onSubmit={handleSubmit} 
                    isSubmitting={isSubmitting} 
                    formMode={formMode}
                    formTitle={formMode === 'edit' ? 'Edit Your Plan Details' : 'Craft Your Plan Manually'}
                />
            )}
        </div>
    </div>
  );
}

