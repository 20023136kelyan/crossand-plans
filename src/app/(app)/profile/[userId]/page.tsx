'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
    User, Loader2, CalendarDays, Smartphone, Home, ListChecks, Palette, Sparkles as GamificationIcon, 
    Wallet, MessagesSquare as SocialInteractionIcon, Heart, Activity, AlertTriangle, ChefHat, ChevronDown, 
    ChevronUp, UsersRound, ChevronLeft, Edit3, MessageSquare, ShieldCheck as AdminIcon, CheckCircle, UserPlus, X as XIcon, Check 
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useCallback } from "react";
import { getUserProfile, getFriendships } from "@/services/userService"; 
import type { UserProfile, FriendEntry, UserRoleType } from "@/types/user";
import { format } from 'date-fns'; 
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { initiateDirectChatAction } from '@/app/actions/chatActions';
import { sendFriendRequestAction, acceptFriendRequestAction, declineFriendRequestAction, removeFriendAction } from '@/app/actions/friendActions';

const VerificationBadge = ({ role, isVerified }: { role: UserRoleType | null, isVerified: boolean }) => {
  if (role === 'admin') {
    return <AdminIcon className="ml-1.5 h-4 w-4 text-amber-400 fill-amber-500 shrink-0" aria-label="Admin" />;
  }
  if (isVerified) {
    return <CheckCircle className="ml-1.5 h-4 w-4 text-blue-500 fill-blue-200 shrink-0" aria-label="Verified" />;
  }
  return null;
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
    <div className="bg-card/70 backdrop-blur-sm border border-border/30 rounded-xl p-3 min-w-[220px] md:min-w-[250px] h-full flex flex-col shadow-md flex-shrink-0">
      <div className="flex items-center mb-2">
        <Icon className="h-4 w-4 text-primary mr-1.5" />
        <h4 className="text-sm font-semibold text-foreground/90">{title}</h4>
      </div>
      <div className="space-y-1.5 flex-grow">
        {items.map(item => {
          const isListExpanded = expandedLists[item.label] || false;

          if (Array.isArray(item.values) && item.values.length > 0) {
            const displayValues = isListExpanded ? item.values : item.values.slice(0, 3);
            return (
              <div key={item.label}>
                <p className="text-xs font-medium text-muted-foreground/80 mb-0.5">{item.label}:</p>
                <div className="flex flex-wrap gap-1">
                  {displayValues.map((val, idx) => <Badge key={idx} variant="secondary" className="text-xs px-1.5 py-0.5">{val}</Badge>)}
                </div>
                {item.values.length > 3 && (
                  <button
                    onClick={() => toggleListExpansion(item.label)}
                    className="text-xs text-primary hover:underline mt-1 flex items-center"
                  >
                    {isListExpanded ? "Show less" : `(+${item.values.length - 3} more)`}
                    {isListExpanded ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
                  </button>
                )}
              </div>
            );
          }
          if (typeof item.values === 'string' && item.values.trim() !== '') {
            return (
              <div key={item.label}>
                <p className="text-xs font-medium text-muted-foreground/80 mb-0.5">{item.label}:</p>
                <p className="text-xs text-foreground/80">{item.values}</p>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};


export default function FriendProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, currentUserProfile, loading: authLoading } = useAuth(); 
  const { toast } = useToast();
  
  const friendUserId = params.userId as string;

  const [viewedUserProfile, setViewedUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendStatus | 'not_friends' | 'is_self' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isInitiatingChat, setIsInitiatingChat] = useState(false);

  const fetchProfileAndFriendshipStatus = useCallback(async () => {
    if (friendUserId) {
      setProfileLoading(true);
      try {
        const profile = await getUserProfile(friendUserId); 
        setViewedUserProfile(profile);
        if (!profile) {
          toast({ title: "Profile Not Found", description: "This user's profile could not be loaded.", variant: "destructive" });
        }

        if (currentUser && currentUser.uid && profile) {
          if (currentUser.uid === profile.uid) {
            setFriendshipStatus('is_self');
          } else {
            const friendships = await getFriendships(currentUser.uid); 
            const friendEntry = friendships.find(f => f.friendUid === friendUserId);
            setFriendshipStatus(friendEntry?.status || 'not_friends');
          }
        }
      } catch (error) {
        console.error("Error fetching friend profile", error);
        toast({ title: "Error", description: "Could not fetch user profile.", variant: "destructive" });
      } finally {
        setProfileLoading(false);
      }
    }
  }, [friendUserId, toast, currentUser]);

  useEffect(() => {
    fetchProfileAndFriendshipStatus();
  }, [fetchProfileAndFriendshipStatus]);

  const handleFriendAction = async (actionType: 'send' | 'accept' | 'decline' | 'cancel' | 'remove') => {
    if (!currentUser || !viewedUserProfile) {
      toast({ title: "Action Failed", description: "User data missing or not logged in.", variant: "destructive" });
      if (!currentUser) router.push('/login');
      return;
    }
    setActionLoading(true);
    try {
      await currentUser.getIdToken(true);
      const idToken = await currentUser.getIdToken();
      if (!idToken) {
        toast({ title: "Auth Error", description: "Could not get authentication token.", variant: "destructive" });
        setActionLoading(false);
        return;
      }

      let result: { success: boolean; error?: string; message?: string };

      switch (actionType) {
        case 'send':
          result = await sendFriendRequestAction(viewedUserProfile.uid, idToken);
          if (result.success) {
            setFriendshipStatus('pending_sent');
          }
          break;
        case 'accept':
          result = await acceptFriendRequestAction(viewedUserProfile.uid, idToken);
          if (result.success) {
            setFriendshipStatus('friends');
          }
          break;
        case 'decline':
        case 'cancel':
          result = await declineFriendRequestAction(viewedUserProfile.uid, idToken);
          if (result.success) {
            setFriendshipStatus('not_friends');
          }
          break;
        case 'remove':
          result = await removeFriendAction(viewedUserProfile.uid, idToken);
          if (result.success) {
            setFriendshipStatus('not_friends');
          }
          break;
        default:
          setActionLoading(false);
          return;
      }

      if (result.success) {
        toast({ title: "Success", description: result.message || `Action successful.` });
      } else {
        toast({ title: "Error", description: result.error || "Could not complete action.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to perform action.", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleInitiateChat = async () => {
    if (!currentUser || !currentUserProfile || !viewedUserProfile) {
      toast({ title: "Error", description: "Cannot start chat. User data missing.", variant: "destructive" });
      return;
    }
    setIsInitiatingChat(true);
    try {
      const CUserData = { 
        uid: currentUser.uid,
        name: currentUserProfile.name, 
        avatarUrl: currentUserProfile.avatarUrl,
        role: currentUserProfile.role,
        isVerified: currentUserProfile.isVerified
      };
      const friendData = {
        uid: viewedUserProfile.uid,
        name: viewedUserProfile.name,
        avatarUrl: viewedUserProfile.avatarUrl,
        role: viewedUserProfile.role,
        isVerified: viewedUserProfile.isVerified
      };

      const result = await initiateDirectChatAction(friendData, CUserData);
      if (result.success && result.chatId) {
        toast({ title: "Success", description: "Chat started!" });
        router.push(`/messages/${result.chatId}`);
      } else {
        toast({ title: "Chat Error", description: result.error || "Could not start chat.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error initiating chat:", error);
      toast({ title: "Chat Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsInitiatingChat(false);
    }
  };


  if (authLoading || profileLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!viewedUserProfile) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center text-center">
        <p className="text-lg font-semibold">User Profile Not Found</p>
        <p className="text-muted-foreground mb-4">The profile you are looking for does not exist or could not be loaded.</p>
        <Button onClick={() => router.back()}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }
  
  const userInitial = viewedUserProfile.username ? viewedUserProfile.username[0].toUpperCase() : (viewedUserProfile.name ? viewedUserProfile.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : (viewedUserProfile.email ? viewedUserProfile.email[0].toUpperCase() : 'U'));
  const formattedPhoneNumber = viewedUserProfile.countryDialCode && viewedUserProfile.phoneNumber
    ? `${viewedUserProfile.countryDialCode} ${viewedUserProfile.phoneNumber}`
    : viewedUserProfile.phoneNumber;

  return (
    <div className="space-y-4 pb-16 md:pb-8">
      <div className="flex justify-between items-center mb-4">
        <Button variant="outline" onClick={() => router.back()}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        {friendshipStatus === 'friends' && currentUser && currentUser.uid !== viewedUserProfile?.uid && (
          <Button onClick={handleInitiateChat} disabled={isInitiatingChat}>
            {isInitiatingChat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
            Message
          </Button>
        )}
      </div>


      <Card className="shadow-xl bg-card/80 border-border/50">
        <CardHeader className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-24 w-24 border-2 border-background shadow-md">
              {viewedUserProfile?.avatarUrl && <AvatarImage src={viewedUserProfile.avatarUrl} alt={viewedUserProfile.username || viewedUserProfile.name || 'User Avatar'} data-ai-hint="person portrait"/>}
              <AvatarFallback className="text-3xl">{userInitial}</AvatarFallback>
            </Avatar>
            <div className="flex-grow">
              <div className="flex items-center">
                 <CardTitle className="text-2xl font-bold text-primary opacity-60">{viewedUserProfile?.username || 'Macaroom User'}</CardTitle>
                 <VerificationBadge role={viewedUserProfile?.role} isVerified={viewedUserProfile?.isVerified || false} />
              </div>
              <CardDescription className="text-md text-muted-foreground">{viewedUserProfile?.email}</CardDescription>
              {friendshipStatus !== 'is_self' && (
                <div className="mt-4">
                  {friendshipStatus === 'friends' ? (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleInitiateChat} disabled={isInitiatingChat}>
                        {isInitiatingChat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                        Message
                      </Button>
                      <Button 
                        variant="outline" 
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                        onClick={() => handleFriendAction('remove')}
                        disabled={actionLoading}
                      >
                        {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                        Unfriend
                      </Button>
                    </div>
                  ) : friendshipStatus === 'pending_sent' ? (
                    <Button 
                      variant="outline" 
                      onClick={() => handleFriendAction('cancel')}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XIcon className="mr-2 h-4 w-4" />}
                      Request Sent
                    </Button>
                  ) : friendshipStatus === 'pending_received' ? (
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleFriendAction('accept')}
                        disabled={actionLoading}
                      >
                        {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        Accept
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => handleFriendAction('decline')}
                        disabled={actionLoading}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        Decline
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleFriendAction('send')}
                        disabled={actionLoading}
                      >
                        {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                        Add Friend
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={handleInitiateChat}
                        disabled={isInitiatingChat}
                      >
                        {isInitiatingChat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                        Message
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-4">
          <section>
            <h3 className="text-xl font-semibold text-foreground/80 flex items-center mb-2"><User className="mr-2 h-5 w-5 text-primary"/>Personal Information</h3>
            <div className="bg-card/70 backdrop-blur-sm border border-border/30 rounded-xl p-4 space-y-3 shadow-md">
              {formattedPhoneNumber && (
                <div className="flex items-start">
                  <Smartphone className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Phone</p>
                    <p className="text-sm text-foreground/90">{formattedPhoneNumber}</p>
                  </div>
                </div>
              )}
              {viewedUserProfile.birthDate && (
                <div className="flex items-start">
                  <CalendarDays className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Birth Date</p>
                    <p className="text-sm text-foreground/90">{format(viewedUserProfile.birthDate as Date, 'PPP')}</p>
                  </div>
                </div>
              )}
              {viewedUserProfile.physicalAddress && (viewedUserProfile.physicalAddress.street || viewedUserProfile.physicalAddress.city || viewedUserProfile.physicalAddress.state || viewedUserProfile.physicalAddress.zipCode || viewedUserProfile.physicalAddress.country) && (
                <div className="flex items-start">
                  <Home className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Address</p>
                    <p className="text-sm text-foreground/90">
                      {`${viewedUserProfile.physicalAddress.street || ''}${viewedUserProfile.physicalAddress.street && (viewedUserProfile.physicalAddress.city || viewedUserProfile.physicalAddress.state || viewedUserProfile.physicalAddress.zipCode || viewedUserProfile.physicalAddress.country) ? ', ' : ''}${viewedUserProfile.physicalAddress.city || ''}${viewedUserProfile.physicalAddress.city && (viewedUserProfile.physicalAddress.state || viewedUserProfile.physicalAddress.zipCode || viewedUserProfile.physicalAddress.country) ? ', ' : ''}${viewedUserProfile.physicalAddress.state || ''} ${viewedUserProfile.physicalAddress.zipCode || ''}${viewedUserProfile.physicalAddress.zipCode && viewedUserProfile.physicalAddress.country ? ', ' : ''}${viewedUserProfile.physicalAddress.country || ''}`.replace(/, ,/g, ',').replace(/^, |, $/g, '').trim()}
                    </p>
                  </div>
                </div>
              )}
              {!formattedPhoneNumber && !viewedUserProfile.birthDate && !(viewedUserProfile.physicalAddress && (viewedUserProfile.physicalAddress.street || viewedUserProfile.physicalAddress.city || viewedUserProfile.physicalAddress.state || viewedUserProfile.physicalAddress.zipCode || viewedUserProfile.physicalAddress.country)) && (
                 <p className="text-sm text-muted-foreground text-center py-2">No public personal information available.</p>
               )}
            </div>
          </section>
          <Separator/>

          <section>
            <h3 className="text-xl font-semibold text-foreground/80 flex items-center mb-3"><ListChecks className="mr-2 h-5 w-5 text-primary"/>Preferences & Restrictions</h3>
            <div className={cn("flex overflow-x-auto space-x-3 pb-3 pt-1 -mx-1 px-1", "custom-scrollbar-horizontal")}>
              <PreferenceGroupCard
                title="Health & Diet"
                icon={Heart}
                items={[
                  { label: "Allergies", values: viewedUserProfile.allergies },
                  { label: "Dietary Restrictions", values: viewedUserProfile.dietaryRestrictions }
                ]}
              />
              <PreferenceGroupCard
                title="Culinary Tastes"
                icon={ChefHat}
                items={[
                  { label: "Favorite Cuisines", values: viewedUserProfile.favoriteCuisines },
                  { label: "General Food Notes", values: viewedUserProfile.generalPreferences }
                ]}
              />
              <PreferenceGroupCard
                title="Activity Style"
                icon={Activity}
                items={[
                  { label: "Physical Limitations", values: viewedUserProfile.physicalLimitations },
                  { label: "Preferred Activities", values: viewedUserProfile.activityTypePreferences },
                  { label: "Disliked Activities", values: viewedUserProfile.activityTypeDislikes }
                ]}
              />
              <PreferenceGroupCard
                title="Sensitivities"
                icon={AlertTriangle}
                items={[
                  { label: "Environmental Sensitivities", values: viewedUserProfile.environmentalSensitivities }
                ]}
              />
            </div>
             {
              !(viewedUserProfile.allergies && viewedUserProfile.allergies.length > 0) &&
              !(viewedUserProfile.dietaryRestrictions && viewedUserProfile.dietaryRestrictions.length > 0) &&
              !(viewedUserProfile.favoriteCuisines && viewedUserProfile.favoriteCuisines.length > 0) &&
              !(viewedUserProfile.generalPreferences && viewedUserProfile.generalPreferences.trim() !== '') &&
              !(viewedUserProfile.physicalLimitations && viewedUserProfile.physicalLimitations.length > 0) &&
              !(viewedUserProfile.activityTypePreferences && viewedUserProfile.activityTypePreferences.length > 0) &&
              !(viewedUserProfile.activityTypeDislikes && viewedUserProfile.activityTypeDislikes.length > 0) &&
              !(viewedUserProfile.environmentalSensitivities && viewedUserProfile.environmentalSensitivities.length > 0) &&
              ( <p className="text-sm text-muted-foreground text-center py-2">No preferences or restrictions shared.</p> )
            }
          </section>
          <Separator/>

          <section>
            <h3 className="text-xl font-semibold text-foreground/80 flex items-center mb-2"><Palette className="mr-2 h-5 w-5 text-primary"/>Planning Style</h3>
            <div className="bg-card/70 backdrop-blur-sm border border-border/30 rounded-xl p-4 space-y-3 shadow-md">
                {viewedUserProfile.travelTolerance && (
                <div className="flex items-start">
                    <TravelToleranceIcon className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Travel Tolerance</p>
                        <p className="text-sm text-foreground/90">{viewedUserProfile.travelTolerance}</p>
                    </div>
                </div>
                )}
                {viewedUserProfile.budgetFlexibilityNotes && (
                <div className="flex items-start">
                    <Wallet className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Budget Notes</p>
                        <p className="text-sm text-foreground/90">{viewedUserProfile.budgetFlexibilityNotes}</p>
                    </div>
                </div>
                )}
                 {viewedUserProfile.socialPreferences && (
                <>
                    {viewedUserProfile.socialPreferences.preferredGroupSize && (
                    <div className="flex items-start">
                        <UsersRound className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Preferred Group Size</p>
                            <p className="text-sm text-foreground/90">{viewedUserProfile.socialPreferences.preferredGroupSize}</p>
                        </div>
                    </div>
                    )}
                    {viewedUserProfile.socialPreferences.interactionLevel && (
                    <div className="flex items-start">
                        <SocialInteractionIcon className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Interaction Level</p>
                            <p className="text-sm text-foreground/90">{viewedUserProfile.socialPreferences.interactionLevel}</p>
                        </div>
                    </div>
                    )}
                </>
                )}
                {!viewedUserProfile.travelTolerance && !viewedUserProfile.budgetFlexibilityNotes && !(viewedUserProfile.socialPreferences && (viewedUserProfile.socialPreferences.preferredGroupSize || viewedUserProfile.socialPreferences.interactionLevel)) && (
                    <p className="text-sm text-muted-foreground text-center py-2">No planning style preferences shared.</p>
                )}
            </div>
          </section>
          <Separator/>

          <section>
            <h3 className="text-xl font-semibold text-foreground/80 flex items-center mb-2"><CalendarDays className="mr-2 h-5 w-5 text-primary"/>Availability</h3>
             <div className="bg-card/70 backdrop-blur-sm border border-border/30 rounded-xl p-4 shadow-md">
                {viewedUserProfile.availabilityNotes && viewedUserProfile.availabilityNotes.trim() !== '' ? (
                    <div className="flex items-start">
                        <div>
                             <p className="text-xs font-medium text-muted-foreground">Availability Notes</p>
                            <p className="text-sm text-foreground/90">{viewedUserProfile.availabilityNotes}</p>
                        </div>
                    </div>
                ) : (
                     <p className="text-sm text-muted-foreground text-center py-2">No availability notes shared.</p>
                )}
            </div>
          </section>
          <Separator/>
          
          <section>
            <h3 className="text-xl font-semibold mb-2 text-foreground/80 flex items-center"><GamificationIcon className="mr-2 h-5 w-5 text-primary"/>Engagement</h3>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center pt-1">
                <div>
                    <p className="text-2xl font-semibold">{viewedUserProfile.eventAttendanceScore}</p>
                    <p className="text-xs text-muted-foreground">Attendance Score</p>
                </div>
                <div>
                    <p className="text-2xl font-semibold">{viewedUserProfile.levelTitle}</p>
                    <p className="text-xs text-muted-foreground">Level</p>
                </div>
                <div>
                    <div className="flex justify-center items-center">
                        {Array.from({ length: 5 }).map((_, i) => (
                        <GamificationIcon key={i} className={`h-5 w-5 ${i < viewedUserProfile.levelStars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Stars</p>
                </div>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

