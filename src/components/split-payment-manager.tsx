"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HandCoins, CreditCard, ShieldCheck, CircleDollarSign } from "lucide-react";
import Image from "next/image";

export function SplitPaymentManager({ planName }: { planName: string }) {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><HandCoins className="text-primary" /> Split Payments</CardTitle>
        <CardDescription>
          Manage shared expenses for &quot;{planName}&quot; seamlessly. This feature is coming soon!
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-6">
        <div className="relative w-full max-w-xs mx-auto aspect-square">
            <Image 
                src="https://picsum.photos/seed/paymentmanager/400/400" 
                alt="Payment illustration" 
                layout="fill" 
                objectFit="contain" 
                className="rounded-lg"
                data-ai-hint="payment finance"
            />
        </div>
        
        <h3 className="text-xl font-semibold text-foreground">Effortless Expense Sharing is on its Way!</h3>
        <p className="text-muted-foreground">
          Soon, you&apos;ll be able to:
        </p>
        <ul className="list-none space-y-2 text-left max-w-sm mx-auto text-muted-foreground">
          <li className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-accent flex-shrink-0" />
            <span>Securely connect bank cards.</span>
          </li>
          <li className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-accent flex-shrink-0" />
            <span>Split the predicted budget among participants.</span>
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent flex-shrink-0" />
            <span>Take pre-authorization for payments.</span>
          </li>
        </ul>
        <Button disabled className="mt-4">
          Manage Payments (Coming Soon)
        </Button>
      </CardContent>
    </Card>
  );
}
