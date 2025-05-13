
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="relative aspect-video w-full mb-4 rounded-md overflow-hidden">
                    <Image 
                        src={`https://picsum.photos/seed/${plan.id}/400/225`} 
                        alt={plan.name} 
                        fill={true} 
                        style={{ objectFit: 'cover' }}
                        data-ai-hint={generateImageHint(plan.eventType, plan.name)}
                    />
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="flex items-center text-sm text-muted-foreground gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <span>{format(new Date(plan.eventTime), "eee, MMM d, yyyy 'at' HH:mm")}</span>
                </div>
                 <Badge variant={plan.status === 'active' || plan.status === 'confirmed' ? 'default' : 'outline'} className="capitalize w-fit mt-1">
                    {plan.status}
                </Badge>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-muted-foreground line-clamp-3">{plan.description}</p>
              </CardContent>
              <CardFooter className="flex justify-between items-center">
                <Link href={`/plans/${plan.id}/edit`} className="text-sm text-primary hover:underline flex items-center gap-1">
                  <Edit3 className="h-4 w-4" /> Edit
                </Link>
                <Button asChild variant="default" size="sm">
                  <Link href={`/plans/${plan.id}`}>
                    View Details <ArrowRight className="ml-2 h-4 w-4" />
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

// Placeholder Edit Page
export async function EditPlanPage({ params }: { params: { planId: string } }) {
    return (
        <div className="text-center p-10">
            <h1 className="text-2xl font-semibold">Edit Plan (ID: {params.planId})</h1>
            <p className="text-muted-foreground">This edit page is a placeholder.</p>
            <Button asChild className="mt-4"><Link href={`/plans/${params.planId}`}>Back to Plan Details</Link></Button>
        </div>
    );
}
// Create a route for edit page at src/app/plans/[planId]/edit/page.tsx for this to work or remove this.
// For now, we are not creating edit page to keep scope small.

