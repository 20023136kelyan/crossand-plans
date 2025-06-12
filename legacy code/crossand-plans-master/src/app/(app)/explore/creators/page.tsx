// src/app/(app)/explore/creators/page.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2, PackageOpen, ShieldCheck as AdminIcon, CheckCircle, ArrowLeft, BadgeCheck, Search, Users } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { fetchAllFeaturedCreatorsAction, fetchExplorePageDataAction } from '@/app/actions/exploreActions';
import type { Influencer, UserRoleType, Profile } from '@/types/user';
import Image from 'next/image';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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

function CreatorCard({ profile }: { profile: Profile }) {
  const creatorInitial = profile.name ? profile.name.charAt(0).toUpperCase() : '?';

  return (
    <div className="bg-card rounded-lg border border-border/50 hover:bg-accent/10 p-6 transition-colors">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={profile.avatarUrl} alt={profile.name} />
          <AvatarFallback>{creatorInitial}</AvatarFallback>
        </Avatar>
        <div className="flex-grow min-w-0">
          <h3 className="text-lg font-semibold truncate">{profile.name}</h3>
          {profile.type && (
            <Badge variant="secondary" className="mt-1">
              {profile.type}
            </Badge>
          )}
          {profile.location && (
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {profile.location}
            </p>
          )}
          {profile.bio && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {profile.bio}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CreatorsExploreContent({ profiles }: { profiles: Profile[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter profiles based on search term
  const filteredProfiles = profiles.filter(profile => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      profile.name.toLowerCase().includes(searchLower) ||
      profile.type?.toLowerCase().includes(searchLower) ||
      profile.location?.toLowerCase().includes(searchLower) ||
      profile.bio?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <Link href="/explore">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Creators</h1>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search creators..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 rounded-xl w-full"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProfiles.map((profile) => (
            <Link 
              key={profile.id} 
              href={`/users/${profile.id}`}
            >
              <CreatorCard profile={profile} />
            </Link>
          ))}
        </div>

        {filteredProfiles.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Creators Found</h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? `No creators match your search for "${searchTerm}"`
                : "No creators available at the moment."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Server component for data fetching
export default async function ExploreCreatorsPage() {
  const result = await fetchExplorePageDataAction();
  const profiles = result.success ? result.data?.featuredProfiles || [] : [];
  
  return <CreatorsExploreContent profiles={profiles} />;
}
