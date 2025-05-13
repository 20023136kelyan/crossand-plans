
import { getPlanById, getParticipantsByPlanId } from "@/lib/actions/plans";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ParticipantManager } from "@/components/participant-manager";
import { SplitPaymentManager } from "@/components/split-payment-manager";
import { MOCK_USER_ID } from "@/types";
import { format, parseISO } from "date-fns";
import { CalendarDays, Clock, MapPin, Users, DollarSign, AlertCircle, Edit, MessageSquare, Crown, ListOrdered, Star, Lightbulb, ExternalLink } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn, generateImageHint, generateGoogleStaticMapUrl } from "@/lib/utils";
import { DeletePlanButton } from "@/components/delete-plan-button";


const StarRatingDisplay = ({ rating, reviewCount, maxStars = 5 }: { rating?: number; reviewCount?: number; maxStars?: number }) => {
  if (typeof rating !== 'number') {
    return <p className="text-xs text-muted-foreground">No rating available</p>;
  }
  const roundedRating = Math.round(rating * 2) / 2; // Rounds to nearest 0.5

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <div className="flex items-center">
        {[...Array(maxStars)].map((_, index) => (
          <Star
            key={index}
            className={cn(
              "h-3.5 w-3.5",
              index < roundedRating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"
            )}
          />
        ))}
      </div>
      <span className="font-medium text-foreground">{rating.toFixed(1)}</span>
      {reviewCount !== undefined && (
        <span>({reviewCount.toLocaleString()} reviews)</span>
      )}
    </div>
  );
};


export default async function PlanDetailsPage({ params }: { params: { planId: string } }) {
  const plan = await getPlanById(params.planId);
  const participants = await getParticipantsByPlanId(params.planId);

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-8">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold mb-2">Plan Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The plan you are looking for does not exist or may have been removed.
        </p>
        <Button asChild>
          <Link href="/plans">Go to My Plans</Link>
        </Button>
      </div>
    );
  }

  const isHost = plan.hostId === MOCK_USER_ID;

  const constructGoogleMapsSearchUrl = (placeName: string, address?: string | null, city?: string | null) => {
    const queryParts = [placeName, address, city].filter(Boolean).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryParts)}`;
  };

  return (
    <div className="space-y-8">
      <header className="relative rounded-lg overflow-hidden shadow-xl min-h-[250px] md:min-h-[350px] flex items-end p-6 bg-secondary">
        <Image 
            src={generateGoogleStaticMapUrl(plan.location, plan.city, plan.id) || `https://picsum.photos/seed/${plan.id}detailsBanner/1200/400`}
            alt={plan.name}
            fill={true}
            style={{ objectFit: 'cover' }}
            className="z-0"
            data-ai-hint={generateImageHint(plan.eventType, plan.name)}
            priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-10"></div>
        <div className="relative z-20 text-primary-foreground w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <Badge variant="secondary" className="mb-2 text-sm bg-opacity-80 backdrop-blur-sm">{plan.status.toUpperCase()}</Badge>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{plan.name}</h1>
                    <p className="text-lg text-primary-foreground/80 max-w-2xl mt-1">{plan.description}</p>
                </div>
                {isHost && (
                    <div className="flex gap-2">
                        <Button variant="secondary" size="sm" asChild>
                            <Link href={`/plans/${plan.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit Plan</Link>
                        </Button>
                        <DeletePlanButton planId={plan.id} planName={plan.name} />
                    </div>
                )}
            </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <CalendarDays className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Date:</span> {format(new Date(plan.eventTime), "eeee, MMMM d, yyyy")}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Time:</span> {format(new Date(plan.eventTime), "HH:mm")}
                </div>
              </div>
              
              {(!plan.itinerary || plan.itinerary.length === 0) && plan.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <a 
                    href={constructGoogleMapsSearchUrl(plan.location, null, plan.city)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline group"
                  >
                    <span className="font-semibold">Start Location:</span> {`${plan.location}, ${plan.city}`}
                    <ExternalLink className="inline-block h-3 w-3 ml-1 opacity-0 group-hover:opacity-70 transition-opacity" />
                  </a>
                </div>
              )}
              {plan.itinerary && plan.itinerary.length > 0 && plan.city && (
                 <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Primary Area:</span> {plan.city}
                     {plan.location && <span className="text-muted-foreground"> (Starting at/near: {plan.location})</span>}
                  </div>
                </div>
              )}


              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Price Range:</span> {plan.priceRange || "Not specified"}
                </div>
              </div>
               {plan.eventType && (
                <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" /> 
                    <div>
                    <span className="font-semibold">Event Type:</span> {plan.eventType}
                    </div>
                </div>
                )}
              <div className="flex items-start gap-3">
                <MessageSquare className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Description:</span>
                  <p className="text-muted-foreground whitespace-pre-wrap">{plan.description}</p>
                </div>
              </div>
            </CardContent>
             <CardFooter className="text-xs text-muted-foreground">
                Created on {format(new Date(plan.createdAt), "MMM d, yyyy")} &bull; Last updated on {format(new Date(plan.updatedAt), "MMM d, yyyy")}
            </CardFooter>
          </Card>

          {plan.itinerary && plan.itinerary.length > 0 && (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListOrdered className="h-5 w-5 text-primary" /> Event Itinerary
                </CardTitle>
                <CardDescription>
                  Here are the stops and activities planned for this event. Click on a stop to open it in maps.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {plan.itinerary.map((item, index) => (
                  <div key={item.id} className="relative">
                    {index > 0 && (
                      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border -translate-x-1/2"></div>
                    )}
                    <div className="flex items-start gap-4">
                       <div className="relative z-10 mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        {index + 1}
                      </div>
                      <div className="flex-1 pt-0.5 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 space-y-1">
                          <a
                            href={constructGoogleMapsSearchUrl(item.placeName, item.address, item.city)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary transition-colors group"
                          >
                            <h4 className="text-lg font-semibold flex items-center">
                              {item.placeName}
                              <ExternalLink className="inline-block h-4 w-4 ml-1.5 opacity-0 group-hover:opacity-70 transition-opacity" />
                            </h4>
                          </a>
                          <StarRatingDisplay rating={item.rating || undefined} reviewCount={item.reviewCount || undefined} />
                          <p className="text-sm text-muted-foreground">
                            {item.address}{item.city ? `, ${item.city}` : ''}
                          </p>
                          {item.description && (
                            <p className="mt-1 text-sm text-muted-foreground/90">{item.description}</p>
                          )}
                           {item.startTime && (
                            <div className="text-xs text-muted-foreground/80 flex items-center gap-1 mt-1">
                              <Clock className="h-3.5 w-3.5" />
                              <span>
                                {format(parseISO(item.startTime), "eee, MMM d, HH:mm")}
                                {item.endTime && ` - ${format(parseISO(item.endTime), "HH:mm")}`}
                              </span>
                            </div>
                          )}
                          {item.activitySuggestions && item.activitySuggestions.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <h5 className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                                <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                                Suggestions for this stop:
                              </h5>
                              <ul className="list-disc list-inside pl-1 space-y-0.5">
                                {item.activitySuggestions.map((suggestion, sIndex) => (
                                  <li key={sIndex} className="text-xs text-muted-foreground/90">{suggestion}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <div className="md:col-span-1 relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-muted border">
                          <Image
                            src={item.googleMapsImageUrl || generateGoogleStaticMapUrl(item.address, item.city, item.id)}
                            alt={`Map of ${item.placeName}`}
                            fill={true}
                            style={{ objectFit: 'cover' }}
                            data-ai-hint={generateImageHint(item.placeName, plan.eventType)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-8">
          <ParticipantManager planId={plan.id} participants={participants} hostId={plan.hostId} />
          <SplitPaymentManager planName={plan.name} />
        </div>
      </div>
    </div>
  );
}

