'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Users, Check, X, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Plan, RSVPStatusType } from '@/types/user';
import { getUserPlans } from '@/services/planService';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { updateMyRSVPAction } from '@/app/actions/planActions';

interface PlanSummaryCardsProps {
  className?: string;
}

export function PlanSummaryCards({ className }: PlanSummaryCardsProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingRsvp, setProcessingRsvp] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = getUserPlans(user.uid, (userPlans) => {
      // Filter for upcoming plans and sort by event time
      const upcomingPlans = userPlans
        .filter(plan => {
          if (!plan.eventTime) return false;
          const eventDate = new Date(plan.eventTime);
          return eventDate > new Date() && plan.status === 'published';
        })
        .sort((a, b) => {
          if (!a.eventTime || !b.eventTime) return 0;
          return new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime();
        })
        .slice(0, 5); // Show only next 5 plans
      
      setPlans(upcomingPlans);
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.uid]);

  const handleRsvpResponse = async (planId: string, response: 'accept' | 'reject') => {
    if (!user?.uid) return;
    
    setProcessingRsvp(planId);
    try {
      const idToken = await user.getIdToken();
      const rsvpStatus: RSVPStatusType = response === 'accept' ? 'going' : 'declined';
      
      const result = await updateMyRSVPAction(planId, idToken, rsvpStatus);
      
      if (result.success) {
        toast({
          title: response === 'accept' ? 'RSVP Accepted' : 'RSVP Declined',
          description: `You have ${response === 'accept' ? 'accepted' : 'declined'} the invitation.`,
        });
        // Trigger a refresh of the plans data
        window.location.reload();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update RSVP. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update RSVP. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setProcessingRsvp(null);
    }
  };

  const handleViewPlan = (planId: string) => {
    router.push(`/plans/${planId}`);
  };

  const getUserRole = (plan: Plan) => {
    if (plan.hostId === user?.uid) return 'host';
    if (plan.invitedParticipantUserIds?.includes(user?.uid || '')) return 'invited';
    if (plan.participantUserIds?.includes(user?.uid || '')) return 'participant';
    return 'unknown';
  };

  const needsRsvp = (plan: Plan) => {
    const role = getUserRole(plan);
    return role === 'invited';
  };

  if (loading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center">
          <Clock className="mr-2 h-4 w-4" />
          Next Adventures
        </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-muted-foreground">Loading plans...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (plans.length === 0) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center">
          <Clock className="mr-2 h-4 w-4" />
          Next Adventures
        </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Clock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No upcoming plans</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center">
          <Clock className="mr-2 h-4 w-4" />
          Next Adventures
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {plans.map((plan) => {
          const role = getUserRole(plan);
          const requiresRsvp = needsRsvp(plan);
          
          return (
            <div
              key={plan.id}
              className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              {/* Plan Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium truncate">{plan.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={role === 'host' ? 'default' : 'secondary'} className="text-xs">
                      {role === 'host' ? 'Host' : role === 'invited' ? 'Invited' : 'Participant'}
                    </Badge>
                    {requiresRsvp && (
                      <Badge variant="outline" className="text-xs text-orange-600">
                        RSVP Needed
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Plan Details */}
              <div className="space-y-1 mb-3">
                {plan.eventTime && (
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Clock className="mr-1.5 h-3 w-3" />
                    {format(new Date(plan.eventTime), 'MMM d, h:mm a')}
                  </div>
                )}
                {plan.location && (
                  <div className="flex items-center text-xs text-muted-foreground">
                    <MapPin className="mr-1.5 h-3 w-3" />
                    <span className="truncate">{plan.location}</span>
                  </div>
                )}
                <div className="flex items-center text-xs text-muted-foreground">
                  <Users className="mr-1.5 h-3 w-3" />
                  {(plan.participantUserIds?.length || 0) + 1} participant{((plan.participantUserIds?.length || 0) + 1) === 1 ? '' : 's'}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewPlan(plan.id)}
                  className="flex-1 h-8 text-xs"
                >
                  <Eye className="mr-1.5 h-3 w-3" />
                  View
                </Button>
                
                {requiresRsvp && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRsvpResponse(plan.id, 'accept')}
                      disabled={processingRsvp === plan.id}
                      className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRsvpResponse(plan.id, 'reject')}
                      disabled={processingRsvp === plan.id}
                      className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}