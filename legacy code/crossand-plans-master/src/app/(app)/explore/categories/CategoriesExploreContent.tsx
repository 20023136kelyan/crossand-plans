'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Search, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import type { Category } from '@/types/user';

function CategoryCard({ name, iconUrl }: { name: string; iconUrl?: string }) {
  return (
    <div className="bg-card rounded-lg border border-border/50 hover:bg-accent/10 p-6 text-center transition-colors">
      {iconUrl ? (
        <img src={iconUrl} alt={name} className="w-12 h-12 mx-auto mb-3" />
      ) : (
        <Layers className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
      )}
      <h3 className="text-lg font-semibold">{name}</h3>
    </div>
  );
}

export function CategoriesExploreContent({ categories }: { categories: Category[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter categories based on search term
  const filteredCategories = categories.filter(category => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      category.name.toLowerCase().includes(searchLower) ||
      category.description?.toLowerCase().includes(searchLower)
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
            <h1 className="text-2xl font-bold">Categories</h1>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search categories..."
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
          {filteredCategories.map((category) => (
            <Link 
              key={category.name} 
              href={`/plans/category/${encodeURIComponent(category.name)}`}
            >
              <CategoryCard 
                name={category.name} 
                iconUrl={category.iconUrl}
              />
            </Link>
          ))}
        </div>

        {filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <Layers className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Categories Found</h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? `No categories match your search for "${searchTerm}"`
                : "No categories available at the moment."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 