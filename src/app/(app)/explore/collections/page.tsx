
// src/app/(app)/explore/collections/page.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2, PackageOpen, Users } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { fetchAllPlanCollectionsAction } from '@/app/actions/exploreActions';
import type { PlanCollection } from '@/types/user';
import Image from 'next/image';

const PAGINATION_PAGE_SIZE = 12; // Define locally

const CollectionGridCard = ({ collection }: { collection: PlanCollection }) => (
  <Link href={`/collections/${collection.id}`} passHref>
    <div className="bg-card rounded-xl shadow-lg hover:shadow-primary/30 transition-shadow border border-border/30 cursor-pointer group flex flex-col h-full">
      <div className="relative bg-muted h-40 w-full rounded-t-xl mb-3 group-hover:opacity-90 transition-opacity overflow-hidden">
        <Image
          src={collection.coverImageUrl || `https://placehold.co/400x250.png?text=${encodeURIComponent(collection.title.substring(0,20))}`}
          alt={collection.title}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 250px"
          style={{ objectFit: 'cover' }}
          data-ai-hint={collection.dataAiHint || collection.tags?.[0] || 'collection abstract'}
          unoptimized={!collection.coverImageUrl || collection.coverImageUrl.includes('placehold.co')}
        />
      </div>
      <div className="flex-grow px-4 pb-3">
        <h3 className="text-lg font-semibold text-foreground truncate mb-1" title={collection.title}>{collection.title}</h3>
        {collection.curatorName && <p className="text-sm text-muted-foreground mb-1">Curated by: {collection.curatorName}</p>}
        <p className="text-sm text-muted-foreground line-clamp-2 h-10 mb-2">{collection.description || `${collection.planIds.length} exciting plans`}</p>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground px-4 py-3 border-t border-border/20 mt-auto">
        <span>{collection.planIds.length} Plan{collection.planIds.length !== 1 ? 's' : ''}</span>
        <Users className="h-4 w-4" />
      </div>
    </div>
  </Link>
);

export default function AllCollectionsPage() {
  const { toast } = useToast();
  const [collections, setCollections] = useState<PlanCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisibleTitle, setLastVisibleTitle] = useState<string | undefined>(undefined);

  const observer = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (loadingMore || !hasMore || !node) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadMoreCollections();
      }
    });
     observer.current.observe(node);
  }, [loadingMore, hasMore]); // Removed loadMoreCollections

  const loadMoreCollections = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchAllPlanCollectionsAction(lastVisibleTitle);
      if (result.success && result.collections) {
        setCollections(prev => [...prev, ...result.collections!]);
        setHasMore(result.hasMore || false);
        setLastVisibleTitle(result.newLastVisibleTitle);
         if (!result.hasMore) {
          if (observer.current) observer.current.disconnect();
        }
      } else {
        toast({ title: "Error Loading More Collections", description: result.error || "Could not load more collections.", variant: "destructive" });
        setHasMore(false);
      }
    } catch (error: any) {
        toast({ title: "Error", description: error.message || "Failed to load more collections.", variant: "destructive" });
        setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [lastVisibleTitle, toast, loadingMore, hasMore]); 

  useEffect(() => {
    async function fetchInitialData() {
      setLoading(true);
      setHasMore(true);
      setLastVisibleTitle(undefined);
      setCollections([]);
      try {
        const result = await fetchAllPlanCollectionsAction();
        if (result.success && result.collections) {
          setCollections(result.collections);
          setHasMore(result.hasMore || false);
          setLastVisibleTitle(result.newLastVisibleTitle);
        } else {
          toast({ title: "Error Loading Collections", description: result.error || "Could not load collections.", variant: "destructive" });
          setHasMore(false);
        }
      } catch (error: any) {
          toast({ title: "Error", description: error.message || "Failed to load collections.", variant: "destructive" });
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
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground/80 opacity-80">All Collections</h1>
        <div className="w-24"></div> {/* Spacer for balance */}
      </div>

      {loading && collections.length === 0 ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : !loading && collections.length === 0 ? (
        <div className="text-center py-20">
          <PackageOpen className="mx-auto h-24 w-24 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-semibold text-foreground">No Collections Found</p>
          <p className="text-muted-foreground">There are no collections to display at the moment.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {collections.map(collection => (
              <CollectionGridCard key={collection.id} collection={collection} />
            ))}
          </div>
           <div ref={loadMoreRef} className="flex justify-center py-6">
            {loadingMore && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
            {!loadingMore && !hasMore && collections.length > 0 && (
              <p className="text-sm text-muted-foreground">You've reached the end!</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
