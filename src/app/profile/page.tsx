

import { getUserProfile } from "@/lib/actions/user";
import { MOCK_USER_ID } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Cake, Home, Phone, Utensils, Accessibility, ThumbsUp, ThumbsDown, Wind, MapPinned, WalletCards, UsersRound, Palette, Asterisk, ImageUp, CalendarPlus, Link as LinkIcon, Star, Award } from "lucide-react";
import { format } from "date-fns";
import type { UserProfile } from "@/types";
import { ProfileEditSection } from "@/components/profile-edit-section";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ItemListDisplay = ({ items, placeholder, variant = "secondary" }: { items: string[] | undefined, placeholder: string, variant?: "default" | "secondary" | "destructive" | "outline" | null | undefined }) => {
  if (items && items.length > 0) {
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((item) => <Badge key={item} variant={variant}>{item}</Badge>)}
      </div>
    );
  }
  return <p className="text-sm text-muted-foreground italic">{placeholder}</p>;
};

const SingleItemDisplay = ({ item, placeholder }: { item: string | undefined | null, placeholder: string }) => {
  if (item) {
    return <p className="text-sm text-muted-foreground">{item}</p>;
  }
  return <p className="text-sm text-muted-foreground italic">{placeholder}</p>;
}

const AddressDisplay = ({ address }: { address: UserProfile['address'] | undefined }) => {
  if (!address || (!address.street && !address.city && !address.country)) {
    return <p className="text-sm text-muted-foreground italic">e.g., 123 Main St, Anytown, CA 90210, US</p>;
  }

  const parts = [
    address.street,
    address.city,
    address.state,
    address.zipCode,
    address.country,
  ].filter(Boolean); // Filter out undefined or empty strings

  return <p className="text-sm text-muted-foreground">{parts.join(', ')}</p>;
};

const StarRating = ({ rating, maxStars = 5 }: { rating: number; maxStars?: number }) => {
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(maxStars)].map((_, index) => (
        <Star
          key={index}
          className={cn(
            "h-4 w-4",
            index < rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/50"
          )}
        />
      ))}
    </div>
  );
};


export default async function ProfilePage() {
  const profile = await getUserProfile(MOCK_USER_ID);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">
          View and manage your personal information and preferences.
        </p>
      </header>

      {profile ? (
        <>
          <Card className="w-full shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                {/* Avatar Block */}
                <div className="shrink-0">
                  <Avatar className="w-24 h-24 sm:w-28 sm:h-28 ring-2 ring-primary ring-offset-2 ring-offset-background">
                    <AvatarImage src={profile.avatarUrl || undefined} alt={`${profile.firstName} ${profile.lastName}`} data-ai-hint="profile avatar" />
                    <AvatarFallback>{`${profile.firstName?.charAt(0) ?? ''}${profile.lastName?.charAt(0) ?? ''}`.toUpperCase() || <ImageUp />}</AvatarFallback>
                  </Avatar>
                </div>
                {/* Info Block */}
                <div className="flex-grow space-y-1 text-center sm:text-left">
                  <CardTitle className="text-2xl sm:text-3xl">{`${profile.firstName} ${profile.lastName}`}</CardTitle>
                  <CardDescription className="text-base sm:text-lg !mt-0.5">
                    {profile.email}
                  </CardDescription>

                  <div className="pt-1 flex flex-col items-center sm:items-start gap-1">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                       <Award className="h-4 w-4 text-primary" /> 
                       <span>{profile.levelTitle} (Score: {profile.eventAttendanceScore})</span>
                    </div>
                    <StarRating rating={profile.levelStars} />
                  </div>
                  
                  {profile.phoneNumber ? (
                    <div className="text-sm text-muted-foreground pt-1 flex items-center justify-center sm:justify-start gap-1.5">
                       <Phone className="h-4 w-4" /> 
                       {profile.phoneNumber}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground/70 pt-1 flex items-center justify-center sm:justify-start gap-1.5 italic">
                      <Phone className="h-4 w-4" />
                      <span>e.g., +1 555-123-4567</span>
                    </div>
                  )}

                  {profile.birthDate && profile.age !== undefined ? (
                    <div className="text-sm text-muted-foreground pt-1 flex items-center justify-center sm:justify-start gap-1.5">
                       <Cake className="h-4 w-4" /> 
                       {format(new Date(profile.birthDate), "MMMM d, yyyy")} ({profile.age} years old)
                    </div>
                  ) : (
                     <div className="text-sm text-muted-foreground/70 pt-1 flex items-center justify-center sm:justify-start gap-1.5 italic">
                      <Cake className="h-4 w-4" />
                      <span>e.g., January 1, 1990</span>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-1 flex items-center gap-1">
                  <Home className="h-4 w-4" /> Address
                </h4>
                <div className="pl-5">
                  <AddressDisplay address={profile.address} />
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold text-sm mb-1 flex items-center gap-1">
                  <Palette className="h-4 w-4" /> Food & Activity Preferences
                </h4>
              </div>
              <div className="pl-5 space-y-3">
                <div>
                    <h5 className="font-medium text-xs text-muted-foreground mb-0.5">Allergies</h5>
                    <ItemListDisplay items={profile.allergies} placeholder="e.g., Peanuts, Shellfish" />
                </div>
                <div>
                    <h5 className="font-medium text-xs text-muted-foreground mb-0.5">Dietary Restrictions</h5>
                    <ItemListDisplay items={profile.dietaryRestrictions} placeholder="e.g., Vegetarian, Gluten-Free" />
                </div>
                <div>
                    <h5 className="font-medium text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                        <Utensils className="h-3 w-3"/> Favorite Cuisines
                    </h5>
                    <ItemListDisplay items={profile.favoriteCuisines} placeholder="e.g., Italian, Mexican, Thai" />
                </div>
                <div>
                    <h5 className="font-medium text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                        <Asterisk className="h-3 w-3" /> General Preferences
                    </h5>
                    <ItemListDisplay items={profile.preferences} placeholder="e.g., Love hiking, Enjoy board games" />
                </div>
              </div>

              <Separator />
              <div>
                <h4 className="font-semibold text-sm mb-1 flex items-center gap-1">
                  <Accessibility className="h-4 w-4" /> Accessibility & Activity Details
                </h4>
              </div>
              <div className="pl-5 space-y-3">
                <div>
                    <h5 className="font-medium text-xs text-muted-foreground mb-0.5">Physical Limitations / Accessibility Needs</h5>
                    <ItemListDisplay items={profile.physicalLimitations} placeholder="e.g., Wheelchair User, Difficulty with Stairs" />
                </div>
                <div>
                    <h5 className="font-medium text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" /> Preferred Activity Types
                    </h5>
                    <ItemListDisplay items={profile.activityTypePreferences} placeholder="e.g., Outdoors, Arts & Culture" />
                </div>
                 <div>
                    <h5 className="font-medium text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                        <ThumbsDown className="h-3 w-3" /> Disliked Activity Types
                    </h5>
                    <ItemListDisplay items={profile.activityTypeDislikes} placeholder="e.g., Loud concerts, Competitive sports" />
                </div>
              </div>

              <Separator />
              <div>
                <h4 className="font-semibold text-sm mb-1 flex items-center gap-1">
                    <Wind className="h-4 w-4" /> Environment & Social
                </h4>
              </div>
              <div className="pl-5 space-y-3">
                <div>
                    <h5 className="font-medium text-xs text-muted-foreground mb-0.5">Environmental Sensitivities</h5>
                    <ItemListDisplay items={profile.environmentalSensitivities} placeholder="e.g., Noise Sensitivity, Crowd Aversion" />
                </div>
                <div>
                    <h5 className="font-medium text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                        <UsersRound className="h-3 w-3" /> Social Preferences
                    </h5>
                    <ItemListDisplay items={profile.socialPreferences} placeholder="e.g., Small groups, Prefers familiar people" />
                </div>
              </div>
              
              <Separator />
              <div>
                <h4 className="font-semibold text-sm mb-1 flex items-center gap-1">
                    <MapPinned className="h-4 w-4" /> Logistics & Other
                </h4>
              </div>
              <div className="pl-5 space-y-3">
                <div>
                    <h5 className="font-medium text-xs text-muted-foreground mb-0.5">Travel Tolerance</h5>
                    <SingleItemDisplay item={profile.travelTolerance} placeholder="e.g., Local only, Up to 1 hour, Flexible" />
                </div>
                 <div>
                    <h5 className="font-medium text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                        <WalletCards className="h-3 w-3" /> Budget Flexibility Notes
                    </h5>
                    <SingleItemDisplay item={profile.budgetFlexibilityNotes} placeholder="e.g., Prefers free events, Budget-conscious" />
                </div>
                <div>
                    <h5 className="font-medium text-xs text-muted-foreground mb-0.5">Availability</h5>
                    <SingleItemDisplay item={profile.availability} placeholder="e.g., Weekends, Weekday evenings after 6 PM" />
                </div>
              </div>

            </CardContent>
          </Card>
          
          <ProfileEditSection initialProfile={profile} />

          <Card className="w-full shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarPlus className="h-5 w-5 text-primary" /> External Calendar Integrations
              </CardTitle>
              <CardDescription>
                Connect your PlanPal account to your favorite calendar services to sync events.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center p-6 bg-secondary/30 rounded-lg">
                <CalendarPlus className="mx-auto h-12 w-12 text-primary mb-4" />
                <h2 className="text-xl font-semibold mb-2">Calendar Integration Coming Soon!</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  We&apos;re working on enabling connections to Google Calendar, Outlook Calendar, and more.
                  Stay tuned to seamlessly sync your plans and never miss an event!
                </p>
              </div>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
                <Button variant="outline" disabled className="w-full sm:w-auto">
                  <LinkIcon className="mr-2 h-4 w-4" /> Connect Google Calendar (Soon)
                </Button>
                <Button variant="outline" disabled className="w-full sm:w-auto">
                  <LinkIcon className="mr-2 h-4 w-4" /> Connect Outlook Calendar (Soon)
                </Button>
              </div>
            </CardContent>
          </Card>

        </>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertCircle className="text-destructive" /> Profile Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              We couldn&apos;t load your profile information. Please try again later or contact support.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

