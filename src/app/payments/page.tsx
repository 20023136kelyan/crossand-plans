
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, WalletCards, Smartphone, History, PlusCircle, ShieldCheck } from "lucide-react";
import Image from "next/image";

const PaymentMethodPlaceholder = ({ icon: Icon, name }: { icon: React.ElementType, name: string }) => (
  <div className="flex flex-col items-center p-4 border rounded-lg bg-secondary/20 hover:shadow-md transition-shadow">
    <Icon className="h-10 w-10 text-primary mb-2" />
    <span className="text-sm font-medium text-foreground">{name}</span>
    <Button variant="outline" size="sm" className="mt-2" disabled>Connect (Soon)</Button>
  </div>
);

export default function PaymentsPage() {
  const popularPaymentMethods = [
    { name: "Visa", icon: CreditCard },
    { name: "Mastercard", icon: CreditCard },
    { name: "American Express", icon: CreditCard },
    { name: "PayPal", icon: WalletCards },
    { name: "Apple Pay", icon: Smartphone },
    { name: "Google Pay", icon: Smartphone },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">
          Securely manage your payment methods and view transaction history for PlanPal.
        </p>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WalletCards className="text-primary" /> Manage Your Payment Methods
          </CardTitle>
          <CardDescription>
            Securely add and manage your payment options for PlanPal services and event contributions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <Button size="lg" disabled>
              <PlusCircle className="mr-2 h-5 w-5" /> Add New Payment Method (Coming Soon)
            </Button>
          </div>
          
          <div className="text-center">
            <p className="text-muted-foreground mb-4">You&apos;ll soon be able to connect various payment methods, including:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {popularPaymentMethods.map((method) => (
                <PaymentMethodPlaceholder key={method.name} icon={method.icon} name={method.name} />
              ))}
            </div>
          </div>

          <div className="mt-6 p-4 border border-dashed rounded-lg bg-background text-center">
            <ShieldCheck className="mx-auto h-12 w-12 text-green-500 mb-3" />
            <h3 className="text-lg font-semibold text-foreground">Robust Payment Integration Under Development</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              We&apos;re building a secure and seamless system for managing event contributions,
              split payments, and pre-authorizations. Stay tuned for these exciting features!
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="text-primary" /> Transaction History
          </CardTitle>
          <CardDescription>
            Review all your PlanPal related transactions.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4 py-12">
           <div className="relative w-full max-w-sm mx-auto aspect-[4/3]">
              <Image 
                  src="https://picsum.photos/seed/transactionhistory/400/300" 
                  alt="Transaction history illustration" 
                  layout="fill" 
                  objectFit="contain" 
                  className="rounded-lg"
                  data-ai-hint="financial report"
              />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Transaction History Coming Soon</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Once payment features are live, you&apos;ll find a detailed record of all your transactions here.
          </p>
          <Button variant="outline" disabled className="mt-4">
            View History (Coming Soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

