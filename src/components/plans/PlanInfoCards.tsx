'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPinIcon, DocumentTextIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { Plan } from '@/types/plan';

interface PlanInfoCardsProps {
  plan: Plan;
}

export function PlanInfoCards({ plan }: PlanInfoCardsProps) {
  return (
    <div className="space-y-6">
      {/* Plan Description */}
      {plan.description && (
        <Card className="border-0 shadow-sm bg-gradient-to-br from-background to-muted/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <DocumentTextIcon className="h-4 w-4 text-primary" />
              </div>
              About This Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{plan.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Additional Details - Only show unique information not in PlanHero */}
      {plan.priceRange && (
        <Card className="border-0 shadow-sm bg-gradient-to-br from-background to-muted/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <CurrencyDollarIcon className="h-4 w-4 text-primary" />
              </div>
              Budget Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Expected Cost:</span>
              <Badge variant="outline" className="font-medium">{plan.priceRange}</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}