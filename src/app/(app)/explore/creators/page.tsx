
// src/app/(app)/explore/creators/page.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2, PackageOpen, ShieldCheck as AdminIcon, CheckCircle } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { fetchAllFeaturedCreatorsAction } from '@/app/actions/exploreActions';
import type { Influencer, UserRoleType } from '@/types/user';
import Image from 'next/image';

const PAGINATION_PAGE_SIZE = 12; // Define locally

const VerificationBadge = ({ role, isVerified }: { role: UserRoleType | null, isVerified: boolean }) => {
  if (role === 'admin') {
    return <AdminIcon className="ml-1 h-4 w-4 text-amber-400 fill-amber-500 shrink-0" aria-label="Admin" />;
  }
  if (isVerified) {
    return <CheckCircle className="ml-1 h-4 w-4 text-blue-500 fill-blue-200 shrink-0" aria-label="Verified" />;
  }
  return null;
};

const InfluencerGridCard = ({ influencer }: { influencer: Influencer }) => (
  <Link href={`/users/${influencer.id}`} passHref>
    <div className="bg-card p-4 rounded-xl shadow-lg hover:shadow-primary/30 transition-shadow border border-border/30 flex flex-col items-center text-center cursor-pointer group h-full">
      <div className="relative bg-muted h-28 w-28 rounded-full mb-3 group-hover:opacity-80 transition-opacity overflow-hidden border-2 border-background">
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
            <span className="text-4xl font-semibold text-primary/60">{influencer.name ? influencer.name.charAt(0) : 'C'}</span>
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

export default function AllCreatorsPage() {
  const { toast } = useToast();
  const [creators, setCreators] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisibleName, setLastVisibleName] = useState<string | undefined>(undefined);
  
  const observer = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (loadingMore || !hasMore || !node) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadMoreCreators();
      }
    });
    observer.current.observe(node);
  }, [loadingMore, hasMore]); // Removed loadMoreCreators from dependency array

  const loadMoreCreators = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchAllFeaturedCreatorsAction(lastVisibleName);
      if (result.success && result.creators) {
        setCreators(prev => [...prev, ...result.creators!]);
        setHasMore(result.hasMore || false);
        setLastVisibleName(result.newLastVisibleName);
        if (!result.hasMore) {
          if (observer.current) observer.current.disconnect();
        }
      } else {
        toast({ title: "Error Loading More Creators", description: result.error || "Could not load more creators.", variant: "destructive" });
        setHasMore(false); 
      }
    } catch (error: any) {
        toast({ title: "Error", description: error.message || "Failed to load more creators.", variant: "destructive" });
        setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [lastVisibleName, toast, loadingMore, hasMore]); 

  useEffect(() => {
    async function fetchInitialData() {
      setLoading(true);
      setHasMore(true); 
      setLastVisibleName(undefined); 
      setCreators([]); 
      try {
        const result = await fetchAllFeaturedCreatorsAction();
        if (result.success && result.creators) {
          setCreators(result.creators);
          setHasMore(result.hasMore || false);
          setLastVisibleName(result.newLastVisibleName);
        } else {
          toast({ title: "Error Loading Creators", description: result.error || "Could not load creators.", variant: "destructive" });
          setHasMore(false);
        }
      } catch (error: any) {
          toast({ title: "Error", description: error.message || "Failed to load creators.", variant: "destructive" });
          setHasMore(false);
      } finally {
        setLoading(false);
      }
    }
    fetchInitialData();
  }, [toast]);

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <Button variant="outline" asChild>
          <Link href="/feed?tab=explore"> {/* Updated link to point to the explore tab */}
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Explore
          </Link>
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground/80 opacity-80">All Featured Creators</h1>
        <div className="w-24"></div> {/* Spacer for balance */}
      </div>

      {loading && creators.length === 0 ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : !loading && creators.length === 0 ? (
        <div className="text-center py-20">
          <PackageOpen className="mx-auto h-24 w-24 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-semibold text-foreground">No Creators Found</p>
          <p className="text-muted-foreground">There are no featured creators to display at the moment.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {creators.map(creator => (
              <InfluencerGridCard key={creator.id} influencer={creator} />
            ))}
          </div>
          <div ref={loadMoreRef} className="flex justify-center py-6">
            {loadingMore && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
            {!loadingMore && !hasMore && creators.length > 0 && (
              <p className="text-sm text-muted-foreground">You've reached the end!</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
