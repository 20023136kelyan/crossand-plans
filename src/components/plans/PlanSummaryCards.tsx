'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Users, Check, X, Eye, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Plan, RSVPStatusType } from '@/types/user';
import { getUserPlansSubscription } from '@/services/clientServices';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { updateMyRSVPAction } from '@/app/actions/planActions';
import { useBulkCompletionStatus, getCompletionDisplayText, isFullyCompleted } from '@/hooks/useCompletionStatus';

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
  
  // Get completion status for all plans
  const completionStatuses = useBulkCompletionStatus(plans, user?.uid || null);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = getUserPlansSubscription(
      user.uid,
      (userPlans) => {
        // Filter for upcoming and recently completed plans
        const relevantPlans = userPlans
          .filter(plan => {
            if (!plan.eventTime) return false;
            const eventDate = new Date(plan.eventTime);
            
            // Include upcoming published plans
            if (eventDate > new Date() && plan.status === 'published') {
              return true;
            }
            
            // Include recently completed plans (within last 30 days)
            // Check completion status using standardized status field
            if (plan.status === 'completed') {
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              return eventDate >= thirtyDaysAgo;
            }
            
            return false;
          })
          .sort((a, b) => {
            if (!a.eventTime || !b.eventTime) return 0;
            // Sort by event time, with upcoming plans first, then completed plans
            const timeA = new Date(a.eventTime).getTime();
            const timeB = new Date(b.eventTime).getTime();
            const now = new Date().getTime();
            
            // If both are upcoming or both are past, sort by time
            if ((timeA > now && timeB > now) || (timeA <= now && timeB <= now)) {
              return timeA - timeB;
            }
            // Upcoming plans come before past plans
            return timeA > now ? -1 : 1;
          })
          .slice(0, 5); // Show only next 5 plans
        
        setPlans(relevantPlans);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching plans for summary cards:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  const handleRsvpResponse = async (planId: string, response: 'accept' | 'reject') => {
    if (!user?.uid) return;
    
    setProcessingRsvp(planId);
    try {
      const idToken = await user.getIdToken();
      const rsvpStatus: RSVPStatusType = response === 'accept' ? 'going' : 'not-going';
      
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
      <Card className={cn("w-full bg-transparent border-none shadow-none", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center text-muted-foreground">
          <Clock className="mr-2 h-4 w-4" />
          Recent & Upcoming
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
      <Card className={cn("w-full bg-transparent border-none shadow-none", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center text-muted-foreground">
          <Clock className="mr-2 h-4 w-4" />
          Recent & Upcoming
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
    <Card className={cn("w-full bg-transparent border-none shadow-none", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center text-muted-foreground">
          <Clock className="mr-2 h-4 w-4" />
          Next Adventures
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {plans.map((plan) => {
          const role = getUserRole(plan);
          const requiresRsvp = needsRsvp(plan);
          const completionStatus = completionStatuses[plan.id];
          const isCompleted = completionStatus?.isPlanCompleted || false;
          const isFullyDone = completionStatus ? isFullyCompleted(completionStatus) : false;
          const displayInfo = completionStatus ? getCompletionDisplayText(completionStatus) : null;
          
          return (
            <div
              key={plan.id}
              className={`p-3 rounded-lg border transition-colors ${
                isFullyDone
                  ? 'bg-green-50/50 border-green-200 hover:bg-green-100/50' 
                  : isCompleted
                  ? 'bg-yellow-50/50 border-yellow-200 hover:bg-yellow-100/50'
                  : 'bg-card hover:bg-accent/50'
              }`}
            >
              {/* Plan Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium truncate">{plan.name}</h4>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant={role === 'host' ? 'default' : 'secondary'} className="text-xs">
                      {role === 'host' ? 'Host' : role === 'invited' ? 'Invited' : 'Participant'}
                    </Badge>
                    {displayInfo && (
                      <Badge 
                        variant={displayInfo.variant} 
                        className={`text-xs ${
                          isFullyDone ? 'bg-green-600 hover:bg-green-700 text-white' :
                          isCompleted ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : ''
                        }`}
                        title={displayInfo.description}
                      >
                        {isFullyDone && <CheckCircle className="w-3 h-3 mr-1" />}
                        {displayInfo.badge}
                      </Badge>
                    )}
                    {requiresRsvp && !isCompleted && (
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
                  {isFullyDone ? 'View Memories' : isCompleted ? 'View Details' : 'View'}
                </Button>
                
                {requiresRsvp && !isCompleted && (
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