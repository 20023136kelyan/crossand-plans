
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlansByUserId } from "@/lib/actions/plans";
import { MOCK_USER_ID } from "@/types";
import { ArrowRight, CalendarDays, PlusCircle, Edit3, Users } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { generateImageHint } from "@/lib/utils";

export default async function PlansPage() {
  const plans = await getPlansByUserId(MOCK_USER_ID);

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">My Plans</h1>
          <p className="text-muted-foreground">
            View and manage your upcoming events.
          </p>
        </div>
        {/* Removed Create New Plan button from here */}
      </header>

      {plans.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col border-none shadow-xl hover:shadow-2xl transition-all duration-500 group overflow-hidden bg-white/60 backdrop-blur-md">
              <div className="relative aspect-video w-full overflow-hidden">
                  <Image 
                      src={`https://picsum.photos/seed/${plan.id}/400/225`} 
                      alt={plan.name} 
                      fill={true} 
                      style={{ objectFit: 'cover' }}
                      data-ai-hint={generateImageHint(plan.eventType, plan.name)}
                      className="group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <Badge variant={plan.status === 'active' || plan.status === 'confirmed' ? 'default' : 'secondary'} className="absolute top-4 right-4 capitalize backdrop-blur-md bg-white/80 text-foreground border-none shadow-sm">
                    {plan.status}
                </Badge>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-2xl font-bold group-hover:text-primary transition-colors">{plan.name}</CardTitle>
                <div className="flex items-center text-sm text-muted-foreground gap-2 pt-1">
                  <CalendarDays className="h-4 w-4 text-accent" />
                  <span>{format(new Date(plan.eventTime), "eee, MMM d, yyyy 'at' HH:mm")}</span>
                </div>
              </CardHeader>
              <CardContent className="flex-grow pt-2">
                <p className="text-muted-foreground/80 line-clamp-2 leading-relaxed">{plan.description}</p>
              </CardContent>
              <CardFooter className="flex justify-between items-center pt-4 border-t border-border/50">
                <Link href={`/plans/${plan.id}/edit`} className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5">
                  <Edit3 className="h-4 w-4" /> Edit
                </Link>
                <Button asChild variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary transition-all group/btn">
                  <Link href={`/plans/${plan.id}`} className="flex items-center">
                    View <ArrowRight className="ml-1.5 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="col-span-full text-center py-12 shadow-md">
          <CardHeader>
            <CalendarDays className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle>No Plans Yet!</CardTitle>
            <CardDescription>
              It looks like you haven&apos;t created any plans.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg">
              <Link href="/plans/create/initiate">
                <PlusCircle className="mr-2 h-5 w-5" /> Create Your First Plan
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
