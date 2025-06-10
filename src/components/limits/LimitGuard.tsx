'use client';

import { useLimits } from '@/hooks/use-limits';
import { useSettings } from '@/context/SettingsContext';
import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Users, Calendar, Crown } from 'lucide-react';
import Link from 'next/link';

interface LimitGuardProps {
  children: ReactNode;
  type: 'plan-creation' | 'participant-addition';
  currentParticipants?: number;
  onLimitReached?: () => void;
  showUpgrade?: boolean;
}

export function LimitGuard({ 
  children, 
  type, 
  currentParticipants = 0, 
  onLimitReached,
  showUpgrade = true 
}: LimitGuardProps) {
  const { 
    canCreatePlan, 
    canAddParticipant, 
    getRemainingPlans, 
    getRemainingParticipants,
    maxPlansPerUser,
    maxParticipantsPerPlan,
    currentPlanCount 
  } = useLimits();
  const { settings } = useSettings();
  
  const siteName = settings?.siteName || 'Macaroom';

  // Check limits based on type
  const isAllowed = type === 'plan-creation' 
    ? canCreatePlan 
    : canAddParticipant(currentParticipants);

  const remaining = type === 'plan-creation'
    ? getRemainingPlans()
    : getRemainingParticipants(currentParticipants);

  const maxLimit = type === 'plan-creation'
    ? maxPlansPerUser
    : maxParticipantsPerPlan;

  const current = type === 'plan-creation'
    ? currentPlanCount
    : currentParticipants;

  // If limit is reached, show limit reached component
  if (!isAllowed) {
    if (onLimitReached) {
      onLimitReached();
    }

    return (
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5" />
            {type === 'plan-creation' ? 'Plan Limit Reached' : 'Participant Limit Reached'}
          </CardTitle>
          <CardDescription className="text-amber-700 dark:text-amber-300">
            {type === 'plan-creation' 
              ? `You've reached your maximum of ${maxLimit} plans.`
              : `This plan has reached the maximum of ${maxLimit} participants.`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border">
            <div className="flex items-center gap-2">
              {type === 'plan-creation' ? (
                <Calendar className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Users className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">
                {type === 'plan-creation' ? 'Plans Created' : 'Participants'}
              </span>
            </div>
            <Badge variant="secondary">
              {current} / {maxLimit}
            </Badge>
          </div>
          
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {type === 'plan-creation' 
                ? 'To create more plans, you can delete some existing ones or upgrade your account.'
                : 'To add more participants, consider creating a new plan or upgrading your account.'
              }
            </p>
            
            {showUpgrade && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade Account
                </Button>
                {type === 'plan-creation' && (
                  <Link href="/plans" className="flex-1">
                    <Button variant="ghost" size="sm" className="w-full">
                      Manage Plans
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // If approaching limit, show warning
  const isApproachingLimit = remaining <= 2 && remaining > 0;
  
  if (isApproachingLimit) {
    return (
      <div className="space-y-4">
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {type === 'plan-creation' 
                  ? `Only ${remaining} plan${remaining !== 1 ? 's' : ''} remaining`
                  : `Only ${remaining} participant slot${remaining !== 1 ? 's' : ''} remaining`
                }
              </span>
            </div>
          </CardContent>
        </Card>
        {children}
      </div>
    );
  }

  // Normal case - render children
  return <>{children}</>;
}

// Helper component to show current usage
export function LimitStatus({ type }: { type: 'plans' | 'participants'; currentParticipants?: number }) {
  const { 
    maxPlansPerUser,
    maxParticipantsPerPlan,
    currentPlanCount,
    getRemainingPlans,
    getRemainingParticipants 
  } = useLimits();

  const isPlans = type === 'plans';
  const current = isPlans ? currentPlanCount : 0; // For participants, this would need to be passed
  const max = isPlans ? maxPlansPerUser : maxParticipantsPerPlan;
  const remaining = isPlans ? getRemainingPlans() : 0; // For participants, this would need currentParticipants
  
  const percentage = (current / max) * 100;
  const isNearLimit = percentage >= 80;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {isPlans ? 'Plans Created' : 'Participants'}
        </span>
        <span className={`font-mono ${isNearLimit ? 'text-amber-600' : 'text-muted-foreground'}`}>
          {current} / {max}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${
            isNearLimit 
              ? 'bg-amber-500' 
              : percentage >= 60 
                ? 'bg-yellow-500' 
                : 'bg-green-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {remaining <= 5 && remaining > 0 && (
        <p className="text-xs text-muted-foreground">
          {remaining} {isPlans ? 'plan' : 'participant'}{remaining !== 1 ? 's' : ''} remaining
        </p>
      )}
    </div>
  );
}