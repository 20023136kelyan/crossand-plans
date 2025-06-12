'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
    User, Edit3, LogOut, Settings, ShieldCheck as AdminIcon, CheckCircle, ChevronLeft,
    Smartphone, CalendarDays, HomeIcon as PhysicalAddressIcon, ListChecks, Palette, Sparkles as GamificationIcon, 
    Wallet, MessagesSquare as SocialInteractionIcon, Heart, Activity, AlertTriangle, ChefHat, 
    ChevronDown, ChevronUp, UsersRound, MapPin as TravelToleranceIcon, Gift, Loader2 
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import type { UserProfile, UserRoleType } from "@/types/user";
import { format, isValid } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const VerificationBadge = ({ role, isVerified }: { role: UserRoleType | null, isVerified: boolean }) => {
  if (role === 'admin') {
    return <AdminIcon className="ml-1.5 h-4 w-4 text-amber-400 fill-amber-500 shrink-0" aria-label="Admin" />;
  }
  if (isVerified) {
    return <CheckCircle className="ml-1.5 h-4 w-4 text-blue-500 fill-blue-200 shrink-0" aria-label="Verified" />;
  }
  return null;
};

interface DetailItemProps {
  icon: React.ElementType;
  label: string;
  value?: string | null | React.ReactNode;
  isList?: boolean;
  className?: string;
}

const DetailItem: React.FC<DetailItemProps> = ({ icon: Icon, label, value, isList, className }) => {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)) {
    return null; 
  }
  return (
    <div className={cn("flex items-start py-1.5", className)}>
      <Icon className="h-4 w-4 text-primary/80 mr-3 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {isList && Array.isArray(value) ? (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {value.map((item, idx) => <Badge key={idx} variant="secondary" className="text-xs px-1.5 py-0.5">{item}</Badge>)}
          </div>
        ) : (
          <p className="text-sm text-foreground/90">{value}</p>
        )}
      </div>
    </div>
  );
};

interface PreferenceGroupCardProps {
  title: string;
  icon: React.ElementType;
  items: { label: string; values: string[] | string | undefined | null }[];
}

const PreferenceGroupCard: React.FC<PreferenceGroupCardProps> = ({ title, icon: Icon, items }) => {
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({});

  const toggleListExpansion = (listLabel: string) => {
    setExpandedLists(prev => ({ ...prev, [listLabel]: !prev[listLabel] }));
  };

  const hasContent = items.some(item =>
    (Array.isArray(item.values) && item.values.length > 0) ||
    (typeof item.values === 'string' && item.values.trim() !== '')
  );

  if (!hasContent) return null;

  return (
    <div className="bg-card/70 backdrop-blur-sm border border-border/20 rounded-xl p-4 w-full h-full flex flex-col shadow-sm">
      <div className="flex items-center mb-3">
        <Icon className="h-4 w-4 text-primary flex-shrink-0" />
        <h4 className="text-sm font-semibold text-foreground/90 ml-2 truncate">{title}</h4>
      </div>
      <div className="space-y-3 flex-grow">
        {items.map(item => {
          const isListExpanded = expandedLists[item.label] || false;

          if (Array.isArray(item.values) && item.values.length > 0) {
            const displayValues = isListExpanded ? item.values : item.values.slice(0, 3);
            return (
              <div key={item.label}>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">{item.label}:</p>
                <div className="flex flex-wrap gap-1.5">
                  {displayValues.map((val, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs px-2 py-0.5 leading-relaxed">
                      {val}
                    </Badge>
                  ))}
                </div>
                {item.values.length > 3 && (
                  <button
                    onClick={() => toggleListExpansion(item.label)}
                    className="text-xs text-primary hover:text-primary/80 hover:underline mt-2 flex items-center"
                    aria-expanded={isListExpanded}
                    aria-label={isListExpanded ? `Show less ${item.label.toLowerCase()}` : `Show ${item.values.length - 3} more ${item.label.toLowerCase()}`}
                  >
                    {isListExpanded ? "Show less" : `Show ${item.values.length - 3} more`}
                    {isListExpanded ? (
                      <ChevronUp className="h-3 w-3 ml-0.5" />
                    ) : (
                      <ChevronDown className="h-3 w-3 ml-0.5" />
                    )}
                  </button>
                )}
              </div>
            );
          }
          if (typeof item.values === 'string' && item.values.trim() !== '') {
            return (
              <div key={item.label}>
                <p className="text-xs font-medium text-muted-foreground mb-1">{item.label}:</p>
                <p className="text-sm text-foreground/90 break-words">{item.values}</p>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};

export default function ProfileSettingsPage() { 
  const { user, loading: authLoading, signOut, currentUserProfile } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleSignOut = async () => {
    await signOut();
    // Toast and router.push('/login') will be handled by AuthContext or a global redirect
  };

  if (authLoading || (!currentUserProfile && user)) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !currentUserProfile) { 
    return null; 
  }

  const userInitial = currentUserProfile.name ? currentUserProfile.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : (currentUserProfile.email ? currentUserProfile.email[0].toUpperCase() : 'U');
  
  const formattedPhoneNumber = currentUserProfile.countryDialCode && currentUserProfile.phoneNumber
    ? `${currentUserProfile.countryDialCode} ${currentUserProfile.phoneNumber}`
    : currentUserProfile.phoneNumber;

  const addressString = currentUserProfile.physicalAddress 
    ? [
        currentUserProfile.physicalAddress.street,
        currentUserProfile.physicalAddress.city,
        currentUserProfile.physicalAddress.state,
        currentUserProfile.physicalAddress.zipCode,
        currentUserProfile.physicalAddress.country,
      ].filter(Boolean).join(', ').trim() || null
    : null;

  return (    <div className="pb-16 md:pb-8 max-w-3xl mx-auto px-4 sm:px-6">
      {/* Page Header */}      <div className="flex items-center justify-between py-3 mb-4 sticky top-0 bg-background/90 backdrop-blur-sm z-10 border-b border-border/30 -mx-4 px-4 sm:-mx-6 sm:px-6">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/users/${user.uid}`)} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
          <span className="sr-only">Back to Profile</span>
        </Button>
        <h1 className="text-lg font-semibold text-foreground/90">Account Settings</h1>
        <div className="w-9 h-9"></div> {/* Spacer for balance */}
      </div>

      {/* Profile Summary Card */}
      <Card className="mb-6 bg-card/70 border-border/30 shadow-md">
        <CardHeader className="flex flex-row items-center gap-4 p-4">
          <Avatar className="h-16 w-16 border-2 border-background shadow-sm">
            {currentUserProfile.avatarUrl && <AvatarImage src={currentUserProfile.avatarUrl} alt={currentUserProfile.name || 'User Avatar'} data-ai-hint="person portrait"/>}
            <AvatarFallback className="text-2xl">{userInitial}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center">
              <h2 className="text-lg font-bold text-foreground/90">{currentUserProfile.name || 'Macaroom User'}</h2>
              <VerificationBadge role={currentUserProfile.role} isVerified={currentUserProfile.isVerified} />
            </div>
            <p className="text-sm text-muted-foreground">{currentUserProfile.email}</p>
          </div>
        </CardHeader>
      </Card>

      {/* Personal Information Section */}
      <section className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-md font-semibold text-foreground/80 flex items-center"><User className="mr-2 h-4 w-4 text-primary/70"/>Personal Information</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link href="/onboarding?step=1"><Edit3 className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" /><span className="sr-only">Edit Personal Information</span></Link>
          </Button>
        </div>
        <Card className="bg-card/50 border-border/20 p-3 sm:p-4 rounded-lg shadow-sm">
          <CardContent className="p-0 space-y-1.5">
            <DetailItem icon={Smartphone} label="Phone" value={formattedPhoneNumber} />
            <DetailItem icon={CalendarDays} label="Birth Date" value={currentUserProfile.birthDate && isValid(currentUserProfile.birthDate as Date) ? format(currentUserProfile.birthDate as Date, 'PPP') : null} />
            <DetailItem icon={PhysicalAddressIcon} label="Address" value={addressString} />
            <DetailItem icon={Edit3} label="Bio" value={currentUserProfile.bio} />
             { !formattedPhoneNumber && !(currentUserProfile.birthDate && isValid(currentUserProfile.birthDate as Date)) && !addressString && !currentUserProfile.bio && (
                <p className="text-xs text-muted-foreground text-center py-2">No personal details provided.</p>
            )}
          </CardContent>
        </Card>
      </section>
      
      <Separator className="my-5 bg-border/20" />

      {/* Preferences & Restrictions Section */}
      <section className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-md font-semibold text-foreground/80 flex items-center"><Heart className="mr-2 h-4 w-4 text-primary/70"/>Preferences & Restrictions</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link href="/onboarding?step=2"><Edit3 className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" /><span className="sr-only">Edit Preferences</span></Link>
          </Button>
        </div>        <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4 auto-rows-fr overflow-x-hidden pt-1")}>
          <PreferenceGroupCard
            title="Health & Diet"
            icon={Heart}
            items={[
              { label: "Allergies", values: currentUserProfile.allergies },
              { label: "Dietary Restrictions", values: currentUserProfile.dietaryRestrictions }
            ]}
          />
          <PreferenceGroupCard
            title="Culinary Tastes"
            icon={ChefHat}
            items={[
              { label: "Favorite Cuisines", values: currentUserProfile.favoriteCuisines },
              { label: "General Food Notes", values: currentUserProfile.generalPreferences }
            ]}
          />
          <PreferenceGroupCard
            title="Activity Style"
            icon={Activity}
            items={[
              { label: "Physical Limitations", values: currentUserProfile.physicalLimitations },
              { label: "Preferred Activities", values: currentUserProfile.activityTypePreferences },
              { label: "Disliked Activities", values: currentUserProfile.activityTypeDislikes }
            ]}
          />
          <PreferenceGroupCard
            title="Sensitivities"
            icon={AlertTriangle}
            items={[
              { label: "Environmental Sensitivities", values: currentUserProfile.environmentalSensitivities }
            ]}
          />
        </div>
         {
          !(currentUserProfile.allergies && currentUserProfile.allergies.length > 0) &&
          !(currentUserProfile.dietaryRestrictions && currentUserProfile.dietaryRestrictions.length > 0) &&
          !(currentUserProfile.favoriteCuisines && currentUserProfile.favoriteCuisines.length > 0) &&
          !(currentUserProfile.generalPreferences && currentUserProfile.generalPreferences.trim() !== '') &&
          !(currentUserProfile.physicalLimitations && currentUserProfile.physicalLimitations.length > 0) &&
          !(currentUserProfile.activityTypePreferences && currentUserProfile.activityTypePreferences.length > 0) &&
          !(currentUserProfile.activityTypeDislikes && currentUserProfile.activityTypeDislikes.length > 0) &&
          !(currentUserProfile.environmentalSensitivities && currentUserProfile.environmentalSensitivities.length > 0) &&
          ( <p className="text-xs text-muted-foreground text-center py-2">No preferences or restrictions specified.</p> )
        }
      </section>
      <Separator className="my-5 bg-border/20" />

      {/* Planning Style Section */}
      <section className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-md font-semibold text-foreground/80 flex items-center"><Palette className="mr-2 h-4 w-4 text-primary/70"/>Planning Style</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link href="/onboarding?step=3"><Edit3 className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" /><span className="sr-only">Edit Planning Style</span></Link>
          </Button>
        </div>
        <Card className="bg-card/50 border-border/20 p-3 sm:p-4 rounded-lg shadow-sm">
          <CardContent className="p-0 space-y-1.5">
            <DetailItem icon={TravelToleranceIcon} label="Travel Tolerance" value={currentUserProfile.travelTolerance} />
            <DetailItem icon={Wallet} label="Budget Notes" value={currentUserProfile.budgetFlexibilityNotes} />
            <DetailItem icon={UsersRound} label="Preferred Group Size" value={currentUserProfile.socialPreferences?.preferredGroupSize} />
            <DetailItem icon={SocialInteractionIcon} label="Interaction Level" value={currentUserProfile.socialPreferences?.interactionLevel} />
            { !currentUserProfile.travelTolerance && !currentUserProfile.budgetFlexibilityNotes && !(currentUserProfile.socialPreferences && (currentUserProfile.socialPreferences.preferredGroupSize || currentUserProfile.socialPreferences.interactionLevel)) && (
                <p className="text-xs text-muted-foreground text-center py-2">No planning style preferences specified.</p>
            )}
          </CardContent>
        </Card>
      </section>
      <Separator className="my-5 bg-border/20" />

      {/* Availability Section */}
      <section className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-md font-semibold text-foreground/80 flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-primary/70"/>Availability</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link href="/onboarding?step=4"><Edit3 className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" /><span className="sr-only">Edit Availability</span></Link>
          </Button>
        </div>
        <Card className="bg-card/50 border-border/20 p-3 sm:p-4 rounded-lg shadow-sm">
          <CardContent className="p-0">
            <DetailItem icon={ListChecks} label="Availability Notes" value={currentUserProfile.availabilityNotes} />
            { !(currentUserProfile.availabilityNotes && currentUserProfile.availabilityNotes.trim() !== '') && (
                <p className="text-xs text-muted-foreground text-center py-2">No availability notes specified.</p>
            )}
          </CardContent>
        </Card>
      </section>
      <Separator className="my-5 bg-border/20" />
      
      {/* Engagement Section */}
      <section className="mb-6">
        <h3 className="text-md font-semibold mb-3 text-foreground/80 flex items-center"><GamificationIcon className="mr-2 h-4 w-4 text-primary/70"/>Engagement</h3>
        <Card className="bg-card/50 border-border/20 p-3 sm:p-4 rounded-lg shadow-sm">
            <CardContent className="p-0 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                <div>
                    <p className="text-xl font-semibold text-foreground/90">{currentUserProfile.eventAttendanceScore}</p>
                    <p className="text-xs text-muted-foreground">Attendance Score</p>
                </div>
                <div>
                    <p className="text-xl font-semibold text-foreground/90">{currentUserProfile.levelTitle}</p>
                    <p className="text-xs text-muted-foreground">Level</p>
                </div>
                <div>
                    <div className="flex justify-center items-center">
                        {Array.from({ length: 5 }).map((_, i) => (
                        <GamificationIcon key={i} className={`h-4 w-4 ${i < currentUserProfile.levelStars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Stars</p>
                </div>
            </CardContent>
        </Card>
      </section>
      <Separator className="my-5 bg-border/20"/>

      {/* App Settings & Actions Section */}
      <section className="mb-6">
         <h3 className="text-md font-semibold mb-3 text-foreground/80 flex items-center"><Settings className="mr-2 h-4 w-4 text-primary/70"/>App Settings</h3>
          <div className="space-y-1 bg-card/50 border-border/20 p-2 rounded-lg shadow-sm">
              <Link href="/users/settings" className="flex items-center p-2 rounded-md hover:bg-secondary/50 transition-colors text-sm text-foreground/80">
                <Settings className="h-4 w-4 mr-3 text-muted-foreground" />Account Settings
              </Link>
              <Link href="/users/settings?tab=subscription" className="flex items-center p-2 rounded-md hover:bg-secondary/50 transition-colors text-sm text-foreground/80">
                <Wallet className="h-4 w-4 mr-3 text-muted-foreground" />Subscription & Billing
              </Link>
              <Link href="/users/settings?tab=security" className="flex items-center p-2 rounded-md hover:bg-secondary/50 transition-colors text-sm text-foreground/80">
                <AdminIcon className="h-4 w-4 mr-3 text-muted-foreground" />Privacy & Security
              </Link>
          </div>
      </section>
      
      <Button variant="destructive" className="w-full mt-4 h-10 text-sm" onClick={handleSignOut}>
        <LogOut className="mr-2 h-4 w-4" /> Log Out
      </Button>

       <CardFooter className="p-4 text-center border-t border-border/20 mt-8">
          <p className="text-xs text-muted-foreground w-full">
              Profile created: {currentUserProfile.createdAt && isValid(currentUserProfile.createdAt as Date) ? format(currentUserProfile.createdAt as Date, 'PPP p') : 'N/A'} <br/>
              Last updated: {currentUserProfile.updatedAt && isValid(currentUserProfile.updatedAt as Date) ? format(currentUserProfile.updatedAt as Date, 'PPP p') : 'N/A'}
          </p>
      </CardFooter>
    </div>
  );
}
