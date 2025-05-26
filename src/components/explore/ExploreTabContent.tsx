// src/components/explore/ExploreTabContent.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Search as SearchIcon, Users, MapPin, Palette, Briefcase, ShieldCheck as AdminIcon, CheckCircle,
  UserPlus, XCircle, Loader2, PackageOpen 
} from "lucide-react";
import type { Plan, Influencer, PlanCollection, UserRoleType, SearchedUser, FriendEntry } from '@/types/user';
import Image from 'next/image';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  searchUsersAction, 
  sendFriendRequestAction, 
  acceptFriendRequestAction, 
  declineFriendRequestAction, 
  removeFriendAction 
} from '@/app/actions/userActions';
import { fetchExplorePageDataAction } from '@/app/actions/exploreActions';
import { getFriendships } from '@/services/userService'; // Client service for current user's friendships
import { cn } from "@/lib/utils";

const VerificationBadge = ({ role, isVerified }: { role: UserRoleType | null, isVerified: boolean }) => {
  if (role === 'admin') {
    return <AdminIcon className="ml-1 h-3.5 w-3.5 text-amber-400 fill-amber-500 shrink-0" aria-label="Admin" />;
  }
  if (isVerified) {
    return <CheckCircle className="ml-1 h-3.5 w-3.5 text-blue-500 fill-blue-200 shrink-0" aria-label="Verified" />;
  }
  return null;
};

const Section = ({ title, children, viewAllHref, itemClassName }: { title: string, children: React.ReactNode, viewAllHref?: string, itemClassName?: string }) => {
  const childCount = React.Children.count(children);
  if (childCount === 0 && !viewAllHref) return null;
  if (childCount === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground/90">{title}</h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-sm font-medium text-primary hover:underline">
            View All
          </Link>
        )}
      </div>
      <div className={cn(
        "flex overflow-x-auto pb-4 custom-scrollbar-horizontal",
        "space-x-4", // Default horizontal spacing
        itemClassName // Allow override for vertical layouts
      )}>
        {children}
      </div>
    </section>
  );
};

const InfluencerCard = ({ influencer }: { influencer: Influencer }) => (
  <Link href={`/users/${influencer.id}`} passHref>
    <div className="bg-card p-4 rounded-xl shadow-lg w-44 flex-shrink-0 hover:shadow-primary/30 transition-shadow border border-border/30 flex flex-col items-center text-center cursor-pointer group h-full">
      <div className="relative bg-muted h-24 w-24 sm:h-28 sm:w-28 rounded-full mb-3 group-hover:opacity-80 transition-opacity overflow-hidden border-2 border-background">
        {influencer.avatarUrl ? (
          <Image
            src={influencer.avatarUrl}
            alt={influencer.name || 'Creator'}
            fill
            sizes="(max-width: 768px) 30vw, 120px"
            style={{ objectFit: 'cover' }}
            data-ai-hint={influencer.dataAiHint || 'profile person'}
            unoptimized={!influencer.avatarUrl?.startsWith('http') || influencer.avatarUrl.includes('placehold.co')}
          />
        ) : (
          <div
            className="w-full h-full bg-muted flex items-center justify-center"
            data-ai-hint={influencer.dataAiHint || 'profile abstract'}
          >
            <span className="text-4xl font-semibold text-primary/60">{influencer.name ? influencer.name.charAt(0).toUpperCase() : 'C'}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-center w-full">
        <p className="text-md font-semibold text-foreground truncate" title={influencer.name || undefined}>{influencer.name || 'Creator'}</p>
        <VerificationBadge role={influencer.role} isVerified={influencer.isVerified || false} />
      </div>
      {influencer.bio && <p className="text-xs text-muted-foreground line-clamp-2 h-8 mt-1">{influencer.bio}</p>}
    </div>
  </Link>
);

const CollectionCard = ({ collection }: { collection: PlanCollection }) => (
  <Link href={`/collections/${collection.id}`} passHref>
    <div className="bg-card rounded-xl shadow-lg w-60 sm:w-64 flex-shrink-0 hover:shadow-primary/30 transition-shadow border border-border/30 cursor-pointer group flex flex-col h-full">
      <div className="relative bg-muted h-36 w-full rounded-t-xl mb-3 group-hover:opacity-90 transition-opacity overflow-hidden">
        <Image
          src={collection.coverImageUrl || `https://placehold.co/300x200.png?text=${encodeURIComponent(collection.title.substring(0,15))}`}
          alt={collection.title}
          fill
          sizes="(max-width: 768px) 60vw, 250px"
          style={{ objectFit: 'cover' }}
          data-ai-hint={collection.dataAiHint || collection.tags?.[0] || 'collection event'}
          unoptimized={!collection.coverImageUrl || collection.coverImageUrl.includes('placehold.co')}
        />
      </div>
      <div className="flex-grow px-3 pb-3">
        <h3 className="text-md font-semibold text-foreground truncate mb-1" title={collection.title}>{collection.title}</h3>
        {collection.curatorName && <p className="text-xs text-muted-foreground mb-1">Curated by: {collection.curatorName}</p>}
        <p className="text-xs text-muted-foreground line-clamp-2 h-8 mb-2">{collection.description || `${collection.planIds.length} exciting plans`}</p>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground px-3 py-2 border-t border-border/20 mt-auto">
        <span>{collection.planIds.length} Plan{collection.planIds.length !== 1 ? 's' : ''}</span>
        <Users className="h-3.5 w-3.5" />
      </div>
    </div>
  </Link>
);

const CategoryChip = ({ name }: { name: string }) => (
  <Link href={`/plans/category/${encodeURIComponent(name)}`} passHref>
    <Button variant="outline" size="lg" className="h-28 w-36 flex-shrink-0 text-md font-medium rounded-xl shadow-md hover:bg-primary/20 hover:border-primary/50 border border-border/50 bg-card transition-all">
      {name}
    </Button>
  </Link>
);

const CityChip = ({ name }: { name: string }) => (
  <Link href={`/plans/city/${encodeURIComponent(name)}`} passHref>
    <Button variant="outline" size="lg" className="h-28 w-36 flex-shrink-0 text-md font-medium rounded-xl shadow-md hover:bg-primary/20 hover:border-primary/50 border border-border/50 bg-card transition-all">
      {name}
    </Button>
  </Link>
);

type FriendStatus = 'friends' | 'pending_sent' | 'pending_received';

const UserSearchResultCard = ({ userResult, onAction, currentUserId, isActionLoading }: {
  userResult: SearchedUser & { friendshipStatus?: FriendStatus | 'is_self' | 'not_friends' };
  onAction: (actionType: 'send' | 'accept' | 'decline' | 'remove' | 'cancel', targetUser: SearchedUser) => void;
  currentUserId: string;
  isActionLoading: boolean;
}) => {
  const userInitial = userResult.name ? userResult.name.charAt(0).toUpperCase() : (userResult.email ? userResult.email.charAt(0).toUpperCase() : 'U');

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/30 shadow-sm hover:shadow-md transition-shadow">
      <Link href={`/users/${userResult.uid}`} className="flex items-center gap-3 flex-grow min-w-0">
        <Avatar className="h-10 w-10">
          <AvatarImage src={userResult.avatarUrl || undefined} alt={userResult.name || 'User'} data-ai-hint="person avatar" />
          <AvatarFallback>{userInitial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center">
            <p className="text-sm font-semibold text-foreground truncate" title={userResult.name || userResult.email || undefined}>{userResult.name || userResult.email}</p>
            <VerificationBadge role={userResult.role || null} isVerified={userResult.isVerified || false} />
          </div>
          <p className="text-xs text-muted-foreground truncate">{userResult.email}</p>
        </div>
      </Link>
      <div className="ml-2 flex-shrink-0">
        {userResult.uid === currentUserId ? (
          <Badge variant="outline" className="text-xs">You</Badge>
        ) : userResult.friendshipStatus === 'friends' ? (
          <Badge variant="default" className="text-xs">Friends</Badge>
        ) : userResult.friendshipStatus === 'pending_sent' ? (
          <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => onAction('cancel', userResult)} disabled={isActionLoading}>
            <XCircle className="mr-1.5 h-3.5 w-3.5" /> Cancel
          </Button>
        ) : userResult.friendshipStatus === 'pending_received' ? (
          <Button className="h-8 px-3 text-xs" onClick={() => onAction('accept', userResult)} disabled={isActionLoading}>
            <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Accept
          </Button>
        ) : (
          <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => onAction('send', userResult)} disabled={isActionLoading}>
            <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add
          </Button>
        )}
      </div>
    </div>
  );
};

export default function ExploreTabContent() {
  const { user, loading: authLoading, currentUserProfile } = useAuth();
  const { toast } = useToast();

  const [allFeaturedCreators, setAllFeaturedCreators] = useState<Influencer[]>([]);
  const [allFeaturedCollections, setAllFeaturedCollections] = useState<PlanCollection[]>([]);
  const [allUniqueCategories, setAllUniqueCategories] = useState<string[]>([]);
  const [allUniqueCities, setAllUniqueCities] = useState<string[]>([]);
  const [initialDataLoading, setInitialDataLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<SearchedUser[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [friendships, setFriendships] = useState<FriendEntry[]>([]); // Initialized as empty array
  const [friendActionLoading, setFriendActionLoading] = useState(false);

  useEffect(() => {
    async function fetchInitialData() {
      setInitialDataLoading(true);
      try {
        const result = await fetchExplorePageDataAction();
        if (result.success && result.data) {
          setAllFeaturedCreators(result.data.featuredCreators);
          setAllFeaturedCollections(result.data.featuredCollections);
          setAllUniqueCategories(result.data.uniqueCategories);
          setAllUniqueCities(result.data.uniqueCities);
        } else {
          toast({ title: "Error Loading Explore Content", description: result.error || "Could not load initial explore data.", variant: "destructive" });
        }
      } catch (error) {
        console.error("Error fetching data for Explore page:", error);
        toast({ title: "Error", description: "Could not load explore content.", variant: "destructive" });
      } finally {
        setInitialDataLoading(false);
      }
    }
    fetchInitialData();
  }, [toast]);

  // Correctly fetch current user's friendships using onSnapshot listener
  useEffect(() => {
    if (user?.uid && !authLoading) {
      const unsubscribe = getFriendships(
        user.uid,
        (updatedFriendships) => {
          setFriendships(updatedFriendships);
        },
        (error) => {
          console.error("Error fetching friendships for explore tab:", error);
          setFriendships([]); // Ensure it's an array on error
          toast({ title: "Friendship Status Error", description: "Could not load friendship statuses.", variant: "default" });
        }
      );
      return () => unsubscribe(); // Cleanup listener
    } else if (!user && !authLoading) {
      setFriendships([]); // No user, so no friendships
    }
  }, [user?.uid, authLoading, toast]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Client-side filtering logic
  const filteredFeaturedCreators = useMemo(() => {
    if (!debouncedSearchTerm) return allFeaturedCreators;
    const lowerSearch = debouncedSearchTerm.toLowerCase();
    return allFeaturedCreators.filter(creator => 
      creator.name.toLowerCase().includes(lowerSearch) ||
      (creator.bio && creator.bio.toLowerCase().includes(lowerSearch))
    );
  }, [allFeaturedCreators, debouncedSearchTerm]);

  const filteredFeaturedCollections = useMemo(() => {
    if (!debouncedSearchTerm) return allFeaturedCollections;
    const lowerSearch = debouncedSearchTerm.toLowerCase();
    return allFeaturedCollections.filter(collection =>
      collection.title.toLowerCase().includes(lowerSearch) ||
      (collection.description && collection.description.toLowerCase().includes(lowerSearch)) ||
      (collection.curatorName && collection.curatorName.toLowerCase().includes(lowerSearch)) ||
      (collection.tags && collection.tags.some(tag => tag.toLowerCase().includes(lowerSearch)))
    );
  }, [allFeaturedCollections, debouncedSearchTerm]);

  const filteredUniqueCategories = useMemo(() => {
    if (!debouncedSearchTerm) return allUniqueCategories;
    const lowerSearch = debouncedSearchTerm.toLowerCase();
    return allUniqueCategories.filter(category => category.toLowerCase().includes(lowerSearch));
  }, [allUniqueCategories, debouncedSearchTerm]);

  const filteredUniqueCities = useMemo(() => {
    if (!debouncedSearchTerm) return allUniqueCities;
    const lowerSearch = debouncedSearchTerm.toLowerCase();
    return allUniqueCities.filter(city => city.toLowerCase().includes(lowerSearch));
  }, [allUniqueCities, debouncedSearchTerm]);


  useEffect(() => {
    const performUserSearch = async () => {
      if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
        setUserSearchResults([]);
        return;
      }
      if (!user) {
        setUserSearchResults([]); 
        return;
      }
      setUserSearchLoading(true);
      try {
        await user.getIdToken(true); 
        const idToken = await user.getIdToken();
        if (!idToken) {
          toast({ title: "Authentication Error", description: "Could not get authentication token for search.", variant: "destructive" });
          setUserSearchResults([]);
          setUserSearchLoading(false);
          return;
        }
        const result = await searchUsersAction(debouncedSearchTerm, idToken);
        if (result.success && result.users) {
          setUserSearchResults(result.users);
        } else {
          setUserSearchResults([]);
          if(result.error && result.error !== "User not found." ) { 
             toast({ title: "User Search Failed", description: result.error, variant: "destructive" });
          }
        }
      } catch (error: any) {
        setUserSearchResults([]);
        toast({ title: "User Search Error", description: error.message || "Could not search users.", variant: "destructive" });
      } finally {
        setUserSearchLoading(false);
      }
    };
    performUserSearch();
  }, [debouncedSearchTerm, user, toast]);

  const combinedUserResults = useMemo(() => {
    if (!user || !userSearchResults || !Array.isArray(userSearchResults)) return [];
    const currentFriendships = Array.isArray(friendships) ? friendships : [];
    const friendsMap = new Map(currentFriendships.map(f => [f.friendUid, f.status as FriendStatus]));
    
    return userSearchResults.map(su => ({
      ...su,
      friendshipStatus: su.uid === user.uid ? ('is_self' as const) : (friendsMap.get(su.uid) || ('not_friends' as const))
    }));
  }, [userSearchResults, friendships, user]);

  const handleFriendAction = async (actionType: 'send' | 'accept' | 'decline' | 'remove' | 'cancel', targetUser: SearchedUser) => {
    if (!user || !currentUserProfile) {
      toast({ title: "Auth Error", description: "Please log in to manage friends.", variant: "destructive" });
      return;
    }
    setFriendActionLoading(true);
    try {
      await user.getIdToken(true);
      const idToken = await user.getIdToken();
      if (!idToken) {
        toast({ title: "Auth Error", description: "Could not get authentication token.", variant: "destructive" });
        setFriendActionLoading(false);
        return;
      }

      let result: { success: boolean; error?: string; message?: string };

      switch (actionType) {
        case 'send':
          result = await sendFriendRequestAction(targetUser.uid, idToken);
          break;
        case 'accept':
          result = await acceptFriendRequestAction(targetUser.uid, idToken);
          break;
        case 'decline':
        case 'cancel':
          result = await declineFriendRequestAction(targetUser.uid, idToken);
          break;
        case 'remove':
          result = await removeFriendAction(targetUser.uid, idToken);
          break;
        default:
          setFriendActionLoading(false);
          return;
      }

      if (result.success) {
        toast({ title: "Success", description: result.message || `Friend action successful.` });
        setUserSearchResults(prev => prev.map(u => {
          if (u.uid === targetUser.uid) {
            if (actionType === 'send') return { ...u, friendshipStatus: 'pending_sent' as const };
            if (actionType === 'accept') return { ...u, friendshipStatus: 'friends' as const };
            if (['decline', 'cancel', 'remove'].includes(actionType)) return { ...u, friendshipStatus: 'not_friends' as const };
          }
          return u;
        }));
      } else {
        toast({ title: "Error", description: result.error || "Could not complete friend action.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Friend Action Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setFriendActionLoading(false);
    }
  };
  
  const noResultsForSearch = debouncedSearchTerm && 
                             !userSearchLoading && 
                             combinedUserResults.length === 0 &&
                             filteredFeaturedCreators.length === 0 &&
                             filteredFeaturedCollections.length === 0 &&
                             filteredUniqueCategories.length === 0 &&
                             filteredUniqueCities.length === 0;

  return (
    <div className="space-y-8 pb-20">
      <div className="relative mt-1 mb-6">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Search people, plans, categories..."
          className="pl-10 h-10 text-sm bg-card border-border/50 focus:border-primary"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {userSearchLoading && (
        <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>
      )}
      {combinedUserResults.length > 0 && !userSearchLoading && (
        <Section title="People" itemClassName="!flex-col !space-y-3 !space-x-0 !overflow-visible !pb-0">
          {combinedUserResults.map(userRes => (
            <UserSearchResultCard
              key={userRes.uid}
              userResult={userRes}
              onAction={handleFriendAction}
              currentUserId={user?.uid || ''}
              isActionLoading={friendActionLoading}
            />
          ))}
        </Section>
      )}
      
      {initialDataLoading && !debouncedSearchTerm && ( // Only show main loader if not searching
        <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
      )}

      {!initialDataLoading && (
        <>
          <Section title="Featured Creators" viewAllHref="/explore/creators">
            {filteredFeaturedCreators.map(creator => (
              <InfluencerCard key={creator.id} influencer={creator} />
            ))}
          </Section>

          <Section title="Curated Collections" viewAllHref="/explore/collections">
            {filteredFeaturedCollections.map(collection => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </Section>

          <Section title="Categories">
            {filteredUniqueCategories.map(category => (
              <CategoryChip key={category} name={category} />
            ))}
          </Section>

          <Section title="Cities">
            {filteredUniqueCities.map(city => (
              <CityChip key={city} name={city} />
            ))}
          </Section>
          
          {noResultsForSearch && (
            <div className="text-center py-10">
                <PackageOpen className="mx-auto h-24 w-24 text-muted-foreground/30 mb-4" />
                <p className="text-lg font-semibold text-foreground">No results found for "{debouncedSearchTerm}".</p>
                <p className="text-muted-foreground">Try a different search term.</p>
            </div>
          )}

          {!initialDataLoading && !debouncedSearchTerm && allFeaturedCreators.length === 0 && allFeaturedCollections.length === 0 && allUniqueCategories.length === 0 && allUniqueCities.length === 0 && combinedUserResults.length === 0 && !userSearchLoading && (
            <div className="text-center py-10">
              <PackageOpen className="mx-auto h-24 w-24 text-muted-foreground/30 mb-4" />
              <p className="text-lg font-semibold text-foreground">Nothing to explore right now.</p>
              <p className="text-muted-foreground">Try searching, or check back later for new content!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

    