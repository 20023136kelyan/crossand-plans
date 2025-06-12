'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useState } from 'react';
import type { City } from '@/types/user';

export function CitiesExploreContent({ cities }: { cities: City[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter cities based on search term
  const filteredCities = cities.filter(city => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      city.name.toLowerCase().includes(searchLower) ||
      city.location?.toLowerCase().includes(searchLower)
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
            <h1 className="text-2xl font-bold">Cities</h1>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search cities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 rounded-xl w-full"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredCities.map((city) => (
            <Link 
              key={city.name} 
              href={`/plans/city/${encodeURIComponent(city.name.toLowerCase())}`}
              className="group"
            >
              <div className="relative aspect-[4/5] rounded-lg overflow-hidden border border-border/50 bg-card hover:bg-accent/10">
                {city.imageUrl ? (
                  <Image
                    src={city.imageUrl}
                    alt={city.name}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <MapPin className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <h3 className="text-xl font-semibold">{city.name}</h3>
                  {city.location && (
                    <p className="text-sm opacity-90">{city.location}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredCities.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Cities Found</h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? `No cities match your search for "${searchTerm}"`
                : "No cities available at the moment."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 