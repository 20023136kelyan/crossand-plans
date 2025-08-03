'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeftIcon as ArrowLeft,
  UsersIcon as Users,
  CheckBadgeIcon as BadgeCheck,
  MagnifyingGlassIcon as Search,
  StarIcon as Star
} from '@heroicons/react/24/outline';
import React, { useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Profile } from '@/types/user';

function CreatorCard({ profile }: { profile: Profile }) {
  return (
    <div className="group relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden hover:shadow-md transition-all p-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={profile.avatarUrl} alt={profile.name} />
          <AvatarFallback>{profile.name[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-semibold truncate">{profile.name}</h3>
            {profile.isVerified && (
              <BadgeCheck className="h-4 w-4 text-blue-500 fill-blue-200 shrink-0" />
            )}
          </div>
          {profile.location && (
            <p className="text-sm text-muted-foreground truncate">{profile.location}</p>
          )}
        </div>
      </div>
      {profile.bio && (
        <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{profile.bio}</p>
      )}
      {profile.tags && profile.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {profile.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0.5 font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function CreatorsExploreContent({ profiles }: { profiles: Profile[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProfiles = profiles.filter(profile =>
    profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.bio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#001B3D] to-[#000510]">
      {/* Header */}
      <div className="sticky top-4 z-50 mx-4">
        <div className="container mx-auto max-w-7xl">
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden">
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-3">
                <Link href="/explore">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <h1 className="text-xl font-semibold">Creators</h1>
              </div>

              {/* Search Bar */}
              <div className="relative max-w-2xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  placeholder="Search creators..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 rounded-full w-full bg-background/50"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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