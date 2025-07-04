'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
    Loader2, Edit3, MessageSquare, ShieldCheck as AdminIcon, CheckCircle, Settings as SettingsIcon, 
    Users as UsersIcon, ChevronLeft, UserPlus, XCircle, ThumbsUp, Check, MoreVertical, Camera,
    LayoutGrid, Calendar, Users, Eye, Upload
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { 
  fetchPublicUserProfileDataAction, 
  sendFriendRequestAction, 
  acceptFriendRequestAction, 
  declineFriendRequestAction, 
  removeFriendAction 
} from '@/app/actions/userActions';
import { getFriendships } from '@/services/clientServices';
import { initiateDirectChatAction } from '@/app/actions/chatActions';
import type { UserProfile, FeedPost, UserStats, FriendEntry, SearchedUser } from "@/types/user";
import { cn } from "@/lib/utils";
import { PostDetailModal } from '@/components/feed/PostDetailModal';

const VerificationBadgeInline = ({ role, isVerified }: { role: UserProfile['role'], isVerified: UserProfile['isVerified'] }) => {
  if (role === 'admin') {
    return <AdminIcon className="ml-1.5 h-5 w-5 text-amber-400 fill-amber-500 shrink-0" aria-label="Admin" />;
  }
  if (isVerified) {
    return <CheckCircle className="ml-1.5 h-5 w-5 text-blue-500 fill-blue-200 shrink-0" aria-label="Verified User" />;
  }
  return null;
};

interface ProfilePageData {
  userProfile: UserProfile | null;
  userPosts: FeedPost[];
  userStats: UserStats | null;
}

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, currentUserProfile, loading: authLoading } = useAuth(); 
  const { toast } = useToast();
  
  const profileId = params.profileId as string;

  const [profileData, setProfileData] = useState<ProfilePageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitiatingChat, setIsInitiatingChat] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendEntry['status'] | 'not_friends' | 'is_self' | null>(null);
  const [friendActionLoading, setFriendActionLoading] = useState(false);

  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null);
  const [isProfilePictureModalOpen, setIsProfilePictureModalOpen] = useState(false);
  
  const friendshipUnsubscribeRef = useRef<(() => void) | null>(null);

  const fetchProfileAndFriendship = useCallback(async () => {
    if (!profileId) {
      setLoading(false);
      toast({ title: "Error", description: "Profile ID missing.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setFriendshipStatus(null); 

    try {
      const result = await fetchPublicUserProfileDataAction(profileId, currentUser?.uid || null);

      if (result.error || !result.userProfile) {
        toast({ title: "Profile Not Found", description: result.error || "This user's profile could not be loaded.", variant: "destructive" });
        setProfileData(null);
      } else {
        setProfileData({ 
          userProfile: result.userProfile, 
          userPosts: result.userPosts || [], 
          userStats: result.userStats 
        });
        
        if (currentUser && currentUser.uid !== profileId && result.userProfile) {
          setFriendActionLoading(true);
          try {
            // Use getFriendships with proper callback pattern
            const unsubscribe = getFriendships(
              currentUser.uid,
              (friendships: FriendEntry[]) => {
                const friendEntry = friendships.find((f: FriendEntry) => f.friendUid === profileId);
                setFriendshipStatus(friendEntry ? friendEntry.status : 'not_friends');
                setFriendActionLoading(false);
              },
              (error: Error) => {
                console.error("Error fetching friendship status:", error);
                setFriendshipStatus('not_friends');
                toast({ title: "Friendship Status Error", description: error.message || "Could not determine friendship status.", variant: "default" });
                setFriendActionLoading(false);
              }
            );
            // Store unsubscribe function for cleanup
            friendshipUnsubscribeRef.current = unsubscribe;
          } catch (fsError: any) {
            console.error("Error fetching friendship status:", fsError);
            setFriendshipStatus('not_friends'); 
            toast({ title: "Friendship Status Error", description: fsError.message || "Could not determine friendship status.", variant: "default" });
            setFriendActionLoading(false);
          }
        } else if (currentUser && currentUser.uid === profileId) {
          setFriendshipStatus('is_self');
        }
      }
    } catch (error: any) {
      console.error("Error fetching public profile data:", error);
      toast({ title: "Error Loading Profile", description: error.message || "Could not load profile.", variant: "destructive" });
      setProfileData(null);
    } finally {
      setLoading(false);
    }
  }, [profileId, currentUser?.uid, toast]); // currentUser?.uid ensures effect re-runs if user logs in/out

  useEffect(() => {
    fetchProfileAndFriendship();
    
    // Cleanup function to unsubscribe from friendship listener
    return () => {
      if (friendshipUnsubscribeRef.current) {
        friendshipUnsubscribeRef.current();
        friendshipUnsubscribeRef.current = null;
      }
    };
  }, [fetchProfileAndFriendship]);

  const { userProfile, userPosts, userStats } = profileData || { userProfile: null, userPosts: [], userStats: null };

  const handleFriendAction = useCallback(async (actionType: 'send' | 'accept' | 'decline' | 'remove' | 'cancel') => {
    if (!currentUser || !userProfile) { // Use userProfile from state
      toast({ title: "Action Failed", description: "User data missing or not logged in.", variant: "destructive" });
      if (!currentUser) router.push('/login');
      return;
    }
    setFriendActionLoading(true);
    try {
      await currentUser.getIdToken(true); // Force refresh
      const idToken = await currentUser.getIdToken();
      if (!idToken) {
        toast({ title: "Authentication Error", description: "Could not get authentication token.", variant: "destructive" });
        setFriendActionLoading(false);
        return;
      }
      let result: { success: boolean; error?: string; message?: string };
      const targetUserInfoForAction: SearchedUser = { 
        uid: userProfile.uid,
        name: userProfile.name,
        username: userProfile.username,
        email: userProfile.email,
        avatarUrl: userProfile.avatarUrl,
        role: userProfile.role,
        isVerified: userProfile.isVerified,
      };

      switch (actionType) {
        case 'send': result = await sendFriendRequestAction(userProfile.uid, idToken); break;
        case 'accept': result = await acceptFriendRequestAction(userProfile.uid, idToken); break;
        case 'decline':
        case 'cancel': result = await declineFriendRequestAction(userProfile.uid, idToken); break;
        case 'remove': result = await removeFriendAction(userProfile.uid, idToken); break;
        default: setFriendActionLoading(false); return;
      }

      if (result.success) {
        toast({ title: "Success", description: result.message || `Action successful.`});
        await fetchProfileAndFriendship(); // Re-fetch profile and friendship status
      } else {
        toast({ title: "Error", description: result.error || "Could not complete action.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to perform action.", variant: "destructive" });
    } finally {
      setFriendActionLoading(false);
    }
  }, [currentUser, userProfile, toast, fetchProfileAndFriendship, router]); // Add userProfile and router

  const handleInitiateChat = useCallback(async () => {
    if (!currentUser || !currentUserProfile || !userProfile) { // Use userProfile from state
      toast({ title: "Action Failed", description: "Cannot start chat. User data missing.", variant: "destructive" });
      if (!currentUser) router.push('/login');
      return;
    }
    if (currentUser.uid === userProfile.uid) {
        toast({ title: "Cannot Message Yourself", variant: "default"});
        return;
    }
    setIsInitiatingChat(true);
    try {
      await currentUser.getIdToken(true); // Force refresh
      const idToken = await currentUser.getIdToken();
      if (!idToken) {
        toast({ title: "Authentication Error", description: "Could not get authentication token for chat.", variant: "destructive" });
        setIsInitiatingChat(false); return;
      }
      const result = await initiateDirectChatAction(
        { 
          uid: userProfile.uid, 
          name: userProfile.name, 
          avatarUrl: userProfile.avatarUrl,
        },
        {
          uid: currentUser.uid,
          name: currentUserProfile?.name || currentUser.displayName,
          avatarUrl: currentUserProfile?.avatarUrl || currentUser.photoURL,
        }
      );
      if (result.success && result.chatId) {
        router.push(`/messages/${result.chatId}`);
      } else {
        toast({ title: "Chat Error", description: result.error || "Could not start chat.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Chat Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsInitiatingChat(false);
    }
  }, [currentUser, currentUserProfile, userProfile, router, toast]); // Add userProfile, router

  const selectedPost = useMemo(() => {
    if (selectedPostIndex !== null && userPosts && userPosts[selectedPostIndex]) {
      return userPosts[selectedPostIndex];
    }
    return null;
  }, [selectedPostIndex, userPosts]);

  const openPostModal = (index: number) => {
    setSelectedPostIndex(index);
    setIsPostModalOpen(true);
  };

  const closePostModal = () => {
    setIsPostModalOpen(false);
    setSelectedPostIndex(null);
  };

  const handleNextPost = () => {
    if (userPosts && selectedPostIndex !== null && selectedPostIndex < userPosts.length - 1) {
      setSelectedPostIndex(selectedPostIndex + 1);
    }
  };

  const handlePreviousPost = () => {
    if (selectedPostIndex !== null && selectedPostIndex > 0) {
      setSelectedPostIndex(selectedPostIndex - 1);
    }
  };

  if (loading || (authLoading && !profileData)) { 
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!userProfile) { // Use userProfile derived from state
    return (
      <div className="flex min-h-screen flex-col items-center justify-center text-center p-6 bg-background text-foreground">
        <UsersIcon className="h-20 w-20 text-muted-foreground/50 mb-4" />
        <h1 className="text-2xl font-semibold mb-2">User Not Found</h1>
        <p className="text-muted-foreground">The profile you are looking for does not exist or could not be loaded.</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/explore">Go to Explore</Link>
        </Button>
      </div>
    );
  }
  
  const userInitial = userProfile.name ? userProfile.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : (userProfile.email ? userProfile.email[0].toUpperCase() : 'U');
  const isOwnProfile = currentUser?.uid === userProfile.uid;

  return (
    <>
      <div className="min-h-screen bg-background text-foreground">
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-3 py-2 bg-background/80 backdrop-blur-sm">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground" aria-label="Go back">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1"></div>
        </header>
        <div className="container mx-auto max-w-3xl px-0 sm:px-4">

          {/* Enhanced Profile Header */}
          <div className="relative bg-gradient-to-br from-background via-background/95 to-muted/20 border-b border-border/30 rounded-b-3xl md:rounded-t-3xl">
            <div className="px-6 pt-8 pb-12">
              <div className="flex items-start gap-6">
                <div className="relative group">
                  <button 
                    onClick={() => setIsProfilePictureModalOpen(true)}
                    className="group relative focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-full"
                  >
                    <Avatar className="h-20 w-20 sm:h-24 sm:w-24 text-xl sm:text-2xl ring-2 ring-border/40 shadow-lg flex-shrink-0 transition-all duration-300 group-hover:ring-primary/50 group-hover:shadow-xl">
                      <AvatarImage src={userProfile.avatarUrl || undefined} alt={userProfile.username || userProfile.name || "User Avatar"} data-ai-hint="person portrait"/>
                      <AvatarFallback className="bg-gradient-to-br from-muted to-muted/80 text-muted-foreground font-semibold">{userInitial}</AvatarFallback>
                    </Avatar>
                  </button>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-green-400 to-green-500 rounded-full border-2 border-background shadow-sm"></div>
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">@{userProfile.username || "user"}</h1>
                      <VerificationBadgeInline role={userProfile.role} isVerified={userProfile.isVerified} />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {isOwnProfile ? (
                        <>
                          <Button size="sm" variant="outline" className="h-8 px-3 text-xs font-medium rounded-lg border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200" asChild>
                            <Link href="/settings">
                              Edit Profile
                            </Link>
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200" asChild>
                            <Link href="/settings">
                              <SettingsIcon className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </>
                      ) : (
                        <>
                          {/* Chat Button */}
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 px-3 text-xs font-medium rounded-lg border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200" 
                            onClick={handleInitiateChat}
                            disabled={friendActionLoading || isInitiatingChat}
                          >
                            {isInitiatingChat ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Chat
                          </Button>
                          
                          {/* Friend Action Button */}
                          {friendshipStatus === 'friends' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 px-3 text-xs font-medium rounded-lg border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all duration-200" 
                              onClick={() => handleFriendAction('remove')}
                              disabled={friendActionLoading}
                            >
                              {friendActionLoading ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Remove Friend
                            </Button>
                          )}
                          
                          {friendshipStatus === 'pending_sent' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 px-3 text-xs font-medium rounded-lg border-border/50 hover:border-destructive/50 hover:bg-destructive/5 transition-all duration-200" 
                              onClick={() => handleFriendAction('cancel')}
                              disabled={friendActionLoading}
                            >
                              {friendActionLoading ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Cancel Request
                            </Button>
                          )}
                          
                          {friendshipStatus === 'pending_received' && (
                            <>
                              <Button 
                                size="sm" 
                                variant="default" 
                                className="h-8 px-3 text-xs font-medium rounded-lg bg-primary hover:bg-primary/90 transition-all duration-200 shadow-sm" 
                                onClick={() => handleFriendAction('accept')}
                                disabled={friendActionLoading}
                              >
                                {friendActionLoading ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5 mr-1.5" />
                                )}
                                Accept
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8 px-3 text-xs font-medium rounded-lg border-border/50 hover:border-destructive/50 hover:bg-destructive/5 transition-all duration-200" 
                                onClick={() => handleFriendAction('decline')}
                                disabled={friendActionLoading}
                              >
                                {friendActionLoading ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                )}
                                Decline
                              </Button>
                            </>
                          )}
                          
                          {friendshipStatus === 'not_friends' && (
                            <Button 
                              size="sm" 
                              variant="default" 
                              className="h-8 px-3 text-xs font-medium rounded-lg bg-primary hover:bg-primary/90 transition-all duration-200 shadow-sm" 
                              onClick={() => handleFriendAction('send')}
                              disabled={friendActionLoading}
                            >
                              {friendActionLoading ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Send Friend Request
                            </Button>
                          )}
                          
                          {/* More Options Dropdown */}
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200">
                            <MoreVertical className="h-3.5 w-3.5" />
                            <span className="sr-only">More options</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {userProfile.name && (
                    <h2 className="text-lg font-semibold text-foreground tracking-tight">{userProfile.name}</h2>
                  )}
                  {userProfile.bio && (
                    <p className="text-sm text-muted-foreground/90 leading-relaxed max-w-md">{userProfile.bio}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-0 bg-background rounded-t-[3rem] -mt-8 relative z-10 pt-4">
            <Tabs defaultValue="posts" className="w-full">
              <TabsList className="w-full flex h-16 bg-transparent p-0">
                <TabsTrigger 
                  value="posts" 
                  className="data-[state=active]:text-foreground data-[state=active]:rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary rounded-none h-full flex flex-col items-center justify-center gap-1 relative text-muted-foreground hover:text-foreground transition-colors px-2 flex-1"
                >
                  <span className="text-lg font-bold text-foreground">{userPosts?.length ?? 0}</span>
                  <LayoutGrid className="h-4 w-4" />
                </TabsTrigger>
                <div className="w-px h-8 bg-border/30 self-center"></div>
                <TabsTrigger 
                  value="plans" 
                  className="data-[state=active]:text-foreground data-[state=active]:rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary rounded-none h-full flex flex-col items-center justify-center gap-1 relative text-muted-foreground hover:text-foreground transition-colors px-2 flex-1"
                >
                  <span className="text-lg font-bold text-foreground">{userStats?.plansCreatedCount ?? 0}</span>
                  <Calendar className="h-4 w-4" />
                </TabsTrigger>
                <div className="w-px h-8 bg-border/30 self-center"></div>
                <TabsTrigger 
                  value="followers" 
                  className="data-[state=active]:text-foreground data-[state=active]:rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary rounded-none h-full flex flex-col items-center justify-center gap-1 relative text-muted-foreground hover:text-foreground transition-colors px-2 flex-1"
                >
                  <span className="text-lg font-bold text-foreground">{userStats?.followersCount ?? 0}</span>
                  <Users className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
              
              {/* Posts Tab Content */}
              <TabsContent value="posts" className="mt-6 p-0">
                {userPosts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Camera className="mx-auto h-16 w-16 opacity-30 mb-3" />
                    <p className="font-semibold text-lg">No Posts Yet</p>
                    {isOwnProfile && <p className="text-sm">Share your first plan highlight!</p>}
                  </div>
                ) : (
                  <div className="columns-3 gap-0.5 sm:gap-1 px-0.5 sm:px-1 pb-4 space-y-0.5 sm:space-y-1">
                    {userPosts.map((post, index) => (
                      <button 
                        key={post.id} 
                        onClick={() => openPostModal(index)}
                        className="relative bg-muted overflow-hidden group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-sm w-full break-inside-avoid mb-0.5 sm:mb-1 block"
                        aria-label={`View post: ${post.text?.substring(0,30) || 'Image post'}`}
                      >
                        {post.mediaUrl ? (
                          <Image
                            src={post.mediaUrl}
                            alt={post.text || `Post by ${userProfile.name}`}
                            width={250}
                            height={250}
                            style={{ 
                              width: '100%', 
                              height: 'auto',
                              objectFit: 'cover'
                            }}
                            className="group-hover:opacity-80 transition-opacity w-full h-auto"
                            data-ai-hint="user generated content"
                            sizes="(max-width: 640px) 33vw, (max-width: 768px) 33vw, 250px"
                            unoptimized={!post.mediaUrl.startsWith('http') || post.mediaUrl.includes('placehold.co') || post.mediaUrl.includes('firebasestorage.googleapis.com')}
                          />
                        ) : (
                          <div className="w-full aspect-square flex items-center justify-center text-xs text-muted-foreground p-1">No Image</div>
                        )}
                      </button>
                    ))}
                   </div>
                 )}
               </TabsContent>
               
               {/* Plans Tab Content */}
               <TabsContent value="plans" className="mt-6 p-0">
                 <div className="text-center py-12 text-muted-foreground">
                   <Calendar className="mx-auto h-16 w-16 opacity-30 mb-3" />
                   <p className="font-semibold text-lg">Plans</p>
                   <p className="text-sm">Created plans will be displayed here</p>
                   <p className="text-xs mt-1">Privacy settings will control visibility</p>
                 </div>
               </TabsContent>
               
               {/* Followers Tab Content */}
               <TabsContent value="followers" className="mt-6 p-0">
                 <div className="text-center py-12 text-muted-foreground">
                   <Users className="mx-auto h-16 w-16 opacity-30 mb-3" />
                   <p className="font-semibold text-lg">Followers</p>
                   <p className="text-sm">Followers list will be displayed here</p>
                   <p className="text-xs mt-1">Privacy settings will control visibility</p>
                 </div>
               </TabsContent>
             </Tabs>
           </div>
         </div>
       </div>

      {selectedPost && isPostModalOpen && userProfile && (
        <PostDetailModal
          post={selectedPost}
          authorProfile={userProfile}
          isOpen={isPostModalOpen}
          onClose={closePostModal}
          onNext={userPosts && selectedPostIndex !== null && selectedPostIndex < userPosts.length - 1 ? handleNextPost : undefined}
          onPrevious={selectedPostIndex !== null && selectedPostIndex > 0 ? handlePreviousPost : undefined}
          hasNext={userPosts && selectedPostIndex !== null && selectedPostIndex < userPosts.length - 1}
          hasPrevious={selectedPostIndex !== null && selectedPostIndex > 0}
        />
      )}
      
      {/* Profile Picture Modal */}
      <Dialog open={isProfilePictureModalOpen} onOpenChange={setIsProfilePictureModalOpen}>
        <DialogContent className="sm:max-w-md p-6 bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Profile Picture</DialogTitle>
            <DialogDescription>
              {isOwnProfile ? "View or change your profile picture" : `View ${userProfile?.name || userProfile?.username}'s profile picture`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="h-32 w-32 border-2 border-border/20 shadow-lg">
              <AvatarImage src={userProfile?.avatarUrl || undefined} alt={userProfile?.username || userProfile?.name || "User Avatar"} />
              <AvatarFallback className="text-2xl font-semibold bg-gradient-to-br from-muted to-muted/80 text-muted-foreground">{userInitial}</AvatarFallback>
            </Avatar>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsProfilePictureModalOpen(false)} className="flex-1">
              Close
            </Button>
            {isOwnProfile ? (
              <Button className="flex-1" onClick={() => {
                setIsProfilePictureModalOpen(false);
                // TODO: Implement upload functionality similar to the post creation interface
              }}>
                <Upload className="h-4 w-4 mr-2" />
                Change Picture
              </Button>
            ) : (
              <Button variant="outline" className="flex-1" onClick={() => {
                // TODO: Implement full-screen view
              }}>
                <Eye className="h-4 w-4 mr-2" />
                View Full Size
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

    