import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Check, Star } from "lucide-react";
import type { Subscription, SubscriptionPlan } from "@/types/subscription";

const planFeatures = {
  basic: [
    "Up to 10 plans",
    "Up to 10 participants per plan",
    "Basic features",
    "Community support",
  ],
  premium: [
    "Up to 100 plans",
    "Up to 50 participants per plan",
    "Premium features",
    "Priority support",
    "Advanced analytics",
  ],
  enterprise: [
    "Unlimited plans",
    "Unlimited participants",
    "All premium features",
    "24/7 Priority support",
    "Custom branding",
    "Dedicated account manager",
  ],
};

const planPrices = {
  basic: { monthly: 0, yearly: 0 },
  premium: { monthly: 9.99, yearly: 99.99 },
  enterprise: { monthly: 29.99, yearly: 299.99 },
};

interface SubscriptionCardProps {
  plan: SubscriptionPlan;
  currentSubscription?: Subscription | null;
  onSubscribe: (plan: SubscriptionPlan) => void;
  onManage: (subscription: Subscription) => void;
}

export function SubscriptionCard({ plan, currentSubscription, onSubscribe, onManage }: SubscriptionCardProps) {
  const isCurrentPlan = currentSubscription?.plan === plan;
  const features = planFeatures[plan];
  const prices = planPrices[plan];

  return (
    <Card className={`w-full max-w-sm ${isCurrentPlan ? 'border-primary' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold capitalize">{plan}</CardTitle>
          {isCurrentPlan && (
            <Badge variant="outline" className="bg-primary/10 text-primary">
              Current Plan
            </Badge>
          )}
        </div>
        <CardDescription>
          {plan === 'basic' ? 'Free forever' : (
            <>
              <span className="text-2xl font-bold">${prices.monthly}</span>
              <span className="text-muted-foreground">/month</span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        {isCurrentPlan ? (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => onManage(currentSubscription)}
          >
            Manage Subscription
          </Button>
        ) : (
          <Button 
            variant={plan === 'basic' ? 'outline' : 'default'} 
            className="w-full"
            onClick={() => onSubscribe(plan)}
          >
            {plan === 'basic' ? 'Get Started' : 'Subscribe'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
} 