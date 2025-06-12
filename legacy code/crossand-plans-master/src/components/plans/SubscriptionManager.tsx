'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import type { Subscription, SubscriptionPlan } from "@/types/subscription";

interface SubscriptionManagerProps {
  plan: SubscriptionPlan;
  currentSubscription?: Subscription | null;
  onSuccess?: () => void;
}

export function SubscriptionManager({ plan, currentSubscription, onSuccess }: SubscriptionManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const isCurrentPlan = currentSubscription?.plan === plan;

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      // Here you would integrate with your payment provider (e.g., Stripe)
      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      });

      if (!response.ok) {
        throw new Error('Failed to create subscription');
      }

      toast({
        title: "Success!",
        description: `You have successfully subscribed to the ${plan} plan.`,
      });

      onSuccess?.();
      setIsOpen(false);
    } catch (error) {
      console.error('Error subscribing:', error);
      toast({
        title: "Error",
        description: "Failed to create subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManage = async () => {
    try {
      // Here you would redirect to your payment provider's customer portal
      const response = await fetch('/api/subscriptions/portal', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error managing subscription:', error);
      toast({
        title: "Error",
        description: "Failed to open subscription management portal. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {isCurrentPlan ? (
        <Button 
          variant="outline" 
          className="w-full"
          onClick={handleManage}
        >
          Manage Subscription
        </Button>
      ) : (
        <Button 
          variant={plan === 'basic' ? 'outline' : 'default'} 
          className="w-full"
          onClick={() => setIsOpen(true)}
        >
          {plan === 'basic' ? 'Get Started' : 'Subscribe'}
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subscribe to {plan} Plan</DialogTitle>
            <DialogDescription>
              {plan === 'basic' 
                ? "You're about to start your free plan. No payment required."
                : "You're about to subscribe to our paid plan. You will be redirected to our payment provider to complete the subscription."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubscribe} disabled={isLoading}>
              {isLoading ? "Processing..." : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 