
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
} from '@/app/actions/userActions'; // Corrected import path
import { fetchExplorePageDataAction } from '@/app/actions/exploreActions';
import { getFriendships } from '@/services/userService'; // Client service

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
  if (React.Children.count(children) === 0) {
    return null;
  }
  return (
    <section className="mb-10">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-foreground/90">{title}</h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-sm font-medium text-primary hover:underline">
            View All
          </Link>
        )}
      </div>
      <div className={`flex overflow-x-auto space-x-4 pb-4 custom-scrollbar-horizontal ${itemClassName || ''}`}>
        {children}
      </div>
    </section>
  );
};

const InfluencerCard = ({ influencer }: { influencer: Influencer }) => (
  <Link href={`/users/${influencer.id}`} passHref> {/* Updated href */}
    <div className="bg-card p-3 rounded-xl shadow-lg w-40 flex-shrink-0 hover:shadow-primary/30 transition-shadow
                  border border-border/30 flex flex-col items-center text-center cursor-pointer group">
      <div className="relative bg-muted h-28 w-28 rounded-full mb-3 group-hover:opacity-80 transition-opacity overflow-hidden">
        {influencer.avatarUrl ? (
          <Image
            src={influencer.avatarUrl}
            alt={influencer.name || 'Creator'}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            style={{ objectFit: 'cover' }}
            data-ai-hint={influencer.dataAiHint || 'profile person'}
            unoptimized={!influencer.avatarUrl?.startsWith('http') || influencer.avatarUrl.includes('placehold.co')}
          />
        ) : (
          <div
            className="w-full h-full bg-muted flex items-center justify-center"
            data-ai-hint={influencer.dataAiHint || 'profile abstract'}
          >
            <span className="text-3xl font-semibold text-primary/60">{influencer.name ? influencer.name.charAt(0) : 'C'}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-center w-full">
        <p className="text-md font-semibold text-foreground truncate" title={influencer.name || undefined}>{influencer.name || 'Creator'}</p>
        <VerificationBadge role={influencer.role} isVerified={influencer.isVerified || false} />
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 h-8">{influencer.bio || 'Featured Creator'}</p>
    </div>
  </Link>
);

const CollectionCard = ({ collection }: { collection: PlanCollection }) => (
  <Link href={`/collections/${collection.id}`} passHref>
    <div className="bg-card p-3 rounded-xl shadow-lg w-64 flex-shrink-0 hover:shadow-primary/30 transition-shadow border border-border/30 cursor-pointer group flex flex-col">
      <div className="relative bg-muted h-32 w-full rounded-md mb-3 group-hover:opacity-90 transition-opacity overflow-hidden">
        <Image
          src={collection.coverImageUrl || `https://placehold.co/300x200.png?text=${encodeURIComponent(collection.title.substring(0,15))}`}
          alt={collection.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          style={{ objectFit: 'cover' }}
          data-ai-hint={collection.dataAiHint || collection.tags?.[0] || 'collection event'}
          unoptimized={!collection.coverImageUrl || collection.coverImageUrl.includes('placehold.co')}
        />
      </div>
      <div className="flex-grow">
        <h3 className="text-md font-semibold text-foreground truncate mb-1" title={collection.title}>{collection.title}</h3>
        {collection.curatorName && <p className="text-xs text-muted-foreground mb-1">Curated by: {collection.curatorName}</p>}
        <p className="text-xs text-muted-foreground line-clamp-2 h-8 mb-2">{collection.description || `${collection.planIds.length} exciting plans`}</p>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/20">
        <span>{collection.planIds.length} Plans</span>
        <Users className="h-3.5 w-3.5" />
      </div>
    </div>
  </Link>
);

const CategoryChip = ({ name }: { name: string }) => (
  <Link href={`/plans/category/${encodeURIComponent(name)}`} passHref>
    <Button variant="secondary" size="lg" className="h-24 w-32 flex-shrink-0 text-sm font-medium rounded-xl shadow-md hover:bg-primary/20 hover:border-primary/50 border border-transparent transition-all">
      {name}
    </Button>
  </Link>
);

const CityChip = ({ name }: { name: string }) => (
  <Link href={`/plans/city/${encodeURIComponent(name)}`} passHref>
    <Button variant="outline" size="lg" className="h-24 w-32 flex-shrink-0 text-sm font-medium rounded-xl shadow-md hover:bg-primary/20 hover:border-primary/50 border border-border/50 transition-all">
      {name}
    </Button>
  </Link>
);

const UserSearchResultCard = ({ userResult, onAction, currentUserId, isActionLoading }: {
  userResult: SearchedUser & { friendshipStatus?: FriendEntry['status'] | 'is_self' | 'not_friends' };
  onAction: (actionType: 'send' | 'accept' | 'decline' | 'remove' | 'cancel', targetUser: SearchedUser) => void;
  currentUserId: string;
  isActionLoading: boolean;
}) => {
  const userInitial = userResult.name ? userResult.name.charAt(0).toUpperCase() : (userResult.email ? userResult.email.charAt(0).toUpperCase() : 'U');

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/30 shadow-sm hover:shadow-md transition-shadow">
      <Link href={`/users/${userResult.uid}`} className="flex items-center gap-3 flex-grow min-w-0"> {/* Updated href */}
        <Avatar className="h-10 w-10">
          <AvatarImage src={userResult.avatarUrl || undefined} alt={userResult.name || 'User'} data-ai-hint="person avatar" />
          <AvatarFallback>{userInitial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center">
            <p className="text-sm font-semibold text-foreground truncate" title={userResult.name || userResult.email || undefined}>{userResult.name || userResult.email}</p>
            <VerificationBadge role={userResult.role} isVerified={userResult.isVerified || false} />
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
          <Button size="xs" variant="outline" onClick={() => onAction('cancel', userResult)} disabled={isActionLoading}>
            <XCircle className="mr-1.5 h-3.5 w-3.5" /> Cancel
          </Button>
        ) : userResult.friendshipStatus === 'pending_received' ? (
          <Button size="xs" onClick={() => onAction('accept', userResult)} disabled={isActionLoading}>
            <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Accept
          </Button>
        ) : (
          <Button size="xs" variant="outline" onClick={() => onAction('send', userResult)} disabled={isActionLoading}>
            <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add
          </Button>
        )}
      </div>
    </div>
  );
};

export default function ExplorePage() {
  const { user, loading: authLoading, currentUserProfile } = useAuth();
  const { toast } = useToast();

  const [featuredCreators, setFeaturedCreators] = useState<Influencer[]>([]);
  const [featuredCollections, setFeaturedCollections] = useState<PlanCollection[]>([]);
  const [uniqueCategories, setUniqueCategories] = useState<string[]>([]);
  const [uniqueCities, setUniqueCities] = useState<string[]>([]);
  const [initialDataLoading, setInitialDataLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<SearchedUser[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [friendships, setFriendships] = useState<FriendEntry[]>([]);
  const [friendActionLoading, setFriendActionLoading] = useState(false);

  useEffect(() => {
    async function fetchInitialData() {
      setInitialDataLoading(true);
      try {
        const result = await fetchExplorePageDataAction();
        if (result.success && result.data) {
          setFeaturedCreators(result.data.featuredCreators);
          setFeaturedCollections(result.data.featuredCollections);
          setUniqueCategories(result.data.uniqueCategories);
          setUniqueCities(result.data.uniqueCities);
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

  const fetchFriendships = useCallback(async () => {
    if (user?.uid) {
      try {
        const fs = await getFriendships(user.uid);
        setFriendships(fs);
      } catch (error) {
        console.error("Error fetching friendships for explore search:", error);
      }
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchFriendships();
  }, [fetchFriendships]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    const performUserSearch = async () => {
      if (!debouncedSearchTerm.trim() || debouncedSearchTerm.length < 2) {
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
          setUserSearchLoading(false);
          return;
        }
        const result = await searchUsersAction(debouncedSearchTerm, idToken);
        if (result.success && result.users) {
          setUserSearchResults(result.users);
           if (result.users.length === 0) {
             // toast({ title: "User Search", description: `No users found matching "${debouncedSearchTerm}".`, variant: "default" });
           }
        } else {
          setUserSearchResults([]);
          if (result.error) toast({ title: "User Search", description: result.error, variant: "default" });
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
    if (!user) return userSearchResults;
    const friendsMap = new Map(friendships.map(f => [f.friendUid, f.status]));
    return userSearchResults.map(su => ({
      ...su,
      friendshipStatus: su.uid === user.uid ? 'is_self' : (friendsMap.get(su.uid) || 'not_friends')
    }));
  }, [userSearchResults, friendships, user]);

  const handleFriendAction = async (actionType: 'send' | 'accept' | 'decline' | 'remove' | 'cancel', targetUser: SearchedUser) => {
    if (!user || !currentUserProfile) {
      toast({ title: "Authentication Error", description: "Please log in to manage friends.", variant: "destructive"});
      return;
    }
    setFriendActionLoading(true);
    try {
      await user.getIdToken(true);
      const idToken = await user.getIdToken();
      if (!idToken) {
          toast({ title: "Authentication Error", description: "Could not perform friend action.", variant: "destructive"});
          setFriendActionLoading(false);
          return;
      }
      let result: { success: boolean; error?: string; message?: string };
      const targetUserInfoForAction = {
        uid: targetUser.uid,
        name: targetUser.name,
        avatarUrl: targetUser.avatarUrl,
        role: targetUser.role,
        isVerified: targetUser.isVerified
      };

      switch (actionType) {
        case 'send': result = await sendFriendRequestAction(targetUserInfoForAction, idToken); break;
        case 'accept': result = await acceptFriendRequestAction(targetUserInfoForAction, idToken); break;
        case 'decline':
        case 'cancel': result = await declineFriendRequestAction(targetUser.uid, idToken); break;
        case 'remove': result = await removeFriendAction(targetUser.uid, idToken); break;
        default: setFriendActionLoading(false); return;
      }

      if (result.success) {
        toast({ title: "Success", description: result.message || `Friend action successful.`});
        fetchFriendships();
        setUserSearchResults(prev => prev.map(u => {
          if (u.uid === targetUser.uid) {
            if (actionType === 'send') return { ...u, friendshipStatus: 'pending_sent' as FriendEntry['status'] };
            if (actionType === 'accept') return { ...u, friendshipStatus: 'friends' as FriendEntry['status'] };
            if (['decline', 'cancel', 'remove'].includes(actionType)) return { ...u, friendshipStatus: 'not_friends' as 'not_friends' };
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

  return (
    <div className="space-y-6 pb-20">
      <h1 className="text-3xl font-bold text-foreground/60 opacity-60">Explore</h1>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search people, plans, categories..."
          className="pl-10 h-10 text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {userSearchLoading && (
        <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>
      )}
      {combinedUserResults.length > 0 && !userSearchLoading && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground/90 mb-4">People</h2>
          <div className="space-y-3">
            {combinedUserResults.map(userRes => (
              <UserSearchResultCard
                key={userRes.uid}
                userResult={userRes}
                onAction={handleFriendAction}
                currentUserId={user?.uid || ''}
                isActionLoading={friendActionLoading}
              />
            ))}
          </div>
        </section>
      )}
      {debouncedSearchTerm.length >= 2 && combinedUserResults.length === 0 && !userSearchLoading && (
         <p className="text-sm text-muted-foreground text-center py-4">No people found matching "{debouncedSearchTerm}".</p>
      )}

      {initialDataLoading && (
        <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
      )}

      {!initialDataLoading && (
        <>
          {featuredCreators.length > 0 && (
            <Section title="Featured Creators" viewAllHref="/explore/creators">
              {featuredCreators.map(creator => (
                <InfluencerCard key={creator.id} influencer={creator} />
              ))}
            </Section>
          )}

          {featuredCollections.length > 0 && (
            <Section title="Curated Collections" viewAllHref="/explore/collections">
              {featuredCollections.map(collection => (
                <CollectionCard key={collection.id} collection={collection} />
              ))}
            </Section>
          )}

          {uniqueCategories.length > 0 && (
            <Section title="Categories">
              {uniqueCategories.map(category => (
                <CategoryChip key={category} name={category} />
              ))}
            </Section>
          )}

          {uniqueCities.length > 0 && (
            <Section title="Cities">
              {uniqueCities.map(city => (
                <CityChip key={city} name={city} />
              ))}
            </Section>
          )}

          {!initialDataLoading && featuredCreators.length === 0 && featuredCollections.length === 0 && uniqueCategories.length === 0 && uniqueCities.length === 0 && combinedUserResults.length === 0 && !userSearchLoading && (
            <div className="text-center py-10">
              <PackageOpen className="mx-auto h-24 w-24 text-muted-foreground/30 mb-4" />
              <p className="text-lg font-semibold text-foreground">Nothing to explore right now.</p>
              <p className="text-muted-foreground">Try creating some plans or check back later!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

