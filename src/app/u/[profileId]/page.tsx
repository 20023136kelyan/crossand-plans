
'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
    Loader2, Edit3, MessageSquare, ShieldCheck as AdminIcon, CheckCircle, Settings as SettingsIcon, 
    Users as UsersIcon, ChevronLeft, UserPlus, XCircle, ThumbsUp, Check, MoreVertical, Camera
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { 
  fetchPublicUserProfileDataAction, 
  sendFriendRequestAction, 
  acceptFriendRequestAction, 
  declineFriendRequestAction, 
  removeFriendAction 
} from '@/app/actions/userActions';
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
            const friendships = await getFriendships(currentUser.uid); // Assumes getFriendships is client-safe
            const friendEntry = friendships.find(f => f.friendUid === profileId);
            setFriendshipStatus(friendEntry ? friendEntry.status : 'not_friends');
          } catch (fsError: any) {
            console.error("Error fetching friendship status:", fsError);
            setFriendshipStatus('not_friends'); 
            toast({ title: "Friendship Status Error", description: fsError.message || "Could not determine friendship status.", variant: "default" });
          } finally {
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
        avatarUrl: userProfile.avatarUrl,
        role: userProfile.role,
        isVerified: userProfile.isVerified,
      };

      switch (actionType) {
        case 'send': result = await sendFriendRequestAction(targetUserInfoForAction, idToken); break;
        case 'accept': result = await acceptFriendRequestAction(targetUserInfoForAction, idToken); break;
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
          // Pass role and isVerified from the viewed profile for chat participant info
          role: userProfile.role,
          isVerified: userProfile.isVerified,
        }, 
        idToken // Pass idToken instead of full currentUserData object
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
        <div className="container mx-auto max-w-3xl px-0 sm:px-4">
          <header className="px-4 py-3 sm:p-4 md:p-6 sticky top-0 bg-background/80 backdrop-blur-sm z-30 border-b border-border/30">
            <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground" aria-label="Go back">
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-md font-semibold text-foreground/90 truncate">{userProfile.name || "Profile"}</h2>
                {isOwnProfile ? (
                     <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-foreground" aria-label="My Settings">
                        <Link href="/users/settings"><SettingsIcon className="h-5 w-5" /></Link>
                     </Button>
                ) : (
                    <div className="w-9 h-9"></div> 
                )}
            </div>
          </header>
          
          <div className="p-4 md:p-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 text-3xl sm:text-4xl border-2 border-primary/30">
                <AvatarImage src={userProfile.avatarUrl || undefined} alt={userProfile.name || "User Avatar"} data-ai-hint="person portrait"/>
                <AvatarFallback>{userInitial}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center sm:text-left w-full">
                <div className="flex items-center justify-center sm:justify-start mb-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-foreground/90">{userProfile.name || "Macaroom User"}</h1>
                  <VerificationBadgeInline role={userProfile.role} isVerified={userProfile.isVerified} />
                </div>
                <div className="flex justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2 flex-wrap">
                  <div><span className="font-semibold text-foreground/80">{userStats?.postCount ?? 0}</span> Posts</div>
                  <div><span className="font-semibold text-foreground/80">{userStats?.friendsCount ?? 0}</span> Friends</div>
                  <div><span className="font-semibold text-foreground/80">{userStats?.plansCreatedCount ?? 0}</span> Plans</div>
                  <div><span className="font-semibold text-foreground/80">{userStats?.plansSharedOrExperiencedCount ?? 0}</span> Shared</div>
                </div>
                {userProfile.bio && (
                  <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed line-clamp-3 sm:line-clamp-2">{userProfile.bio}</p>
                )}
              </div>
            </div>

            <div className="mt-4 sm:mt-5 flex flex-col sm:flex-row gap-2">
              {isOwnProfile ? (
                <Button variant="outline" className="w-full sm:flex-1" asChild>
                  <Link href="/onboarding">
                    <Edit3 className="mr-2 h-4 w-4" /> Edit Profile
                  </Link>
                </Button>
              ) : (
                <>
                  <Button 
                    variant={friendshipStatus === 'friends' ? 'secondary' : (friendshipStatus === 'pending_sent' ? 'outline' : 'default')} 
                    className="w-full sm:flex-1" 
                    disabled={friendActionLoading || friendshipStatus === 'is_self' || friendshipStatus === null}
                    onClick={() => {
                      if (friendshipStatus === 'not_friends') handleFriendAction('send');
                      else if (friendshipStatus === 'pending_received') handleFriendAction('accept');
                      else if (friendshipStatus === 'pending_sent') handleFriendAction('cancel');
                      else if (friendshipStatus === 'friends') handleFriendAction('remove');
                    }}
                  >
                    {friendActionLoading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                    {friendshipStatus === 'friends' ? <><UserPlus className="mr-2 h-4 w-4 text-destructive" /> Unfriend</> 
                      : friendshipStatus === 'pending_sent' ? <><XCircle className="mr-2 h-4 w-4"/>Request Sent</>
                      : friendshipStatus === 'pending_received' ? <><Check className="mr-2 h-4 w-4"/>Accept Request</>
                      : friendshipStatus === 'not_friends' ? <><UserPlus className="mr-2 h-4 w-4"/>Add Friend</>
                      : 'Loading Status...'}
                  </Button>
                  <Button variant="outline" className="w-full sm:flex-1" onClick={handleInitiateChat} disabled={isInitiatingChat}>
                    {isInitiatingChat ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <MessageSquare className="mr-2 h-4 w-4" />} Message
                  </Button>
                </>
              )}
            </div>
          </div>
          
          <div className="border-t border-border/30 pt-1">
            {userPosts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Camera className="mx-auto h-16 w-16 opacity-30 mb-3" />
                <p className="font-semibold text-lg">No Posts Yet</p>
                {isOwnProfile && <p className="text-sm">Share your first plan highlight!</p>}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
                {userPosts.map((post, index) => (
                  <button 
                    key={post.id} 
                    onClick={() => openPostModal(index)}
                    className="aspect-square relative bg-muted overflow-hidden group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-sm"
                    aria-label={`View post: ${post.text?.substring(0,30) || 'Image post'}`}
                  >
                    {post.mediaUrl ? (
                        <Image
                        src={post.mediaUrl}
                        alt={post.text || `Post by ${userProfile.name}`}
                        fill
                        sizes="(max-width: 640px) 33vw, (max-width: 768px) 33vw, 250px"
                        style={{ objectFit: 'cover' }}
                        className="group-hover:opacity-80 transition-opacity"
                        data-ai-hint="user generated content"
                        unoptimized={!post.mediaUrl.startsWith('http') || post.mediaUrl.includes('placehold.co') || post.mediaUrl.includes('firebasestorage.googleapis.com')}
                        />
                    ) : (
                         <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-1">No Image</div>
                    )}
                  </button>
                ))}
              </div>
            )}
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
    </>
  );
}

    