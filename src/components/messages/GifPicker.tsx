'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, X, TrendingUp } from 'lucide-react';
import { searchGifs, getTrendingGifs, type GifObject } from '@/lib/giphy';
import { MediaMessage } from './MediaMessage';
import { cn } from '@/lib/utils';

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
  className?: string;
}

export function GifPicker({ onSelect, onClose, className }: GifPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState<GifObject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load trending GIFs on mount
  const loadTrendingGifs = useCallback(async () => {
    if (!searchQuery.trim()) {
      setIsLoading(true);
      try {
        const trendingGifs = await getTrendingGifs(30);
        setGifs(trendingGifs);
      } catch (error) {
        console.error('Error loading trending GIFs:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [searchQuery]);

  // Search GIFs when query changes (with debounce)
  useEffect(() => {
    const search = async () => {
      if (!searchQuery.trim()) {
        loadTrendingGifs();
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchGifs(searchQuery, 30);
        setGifs(results);
      } catch (error) {
        console.error('Error searching GIFs:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(() => {
      search();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, loadTrendingGifs]);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        'absolute bottom-full right-0 mb-2 w-80 bg-popover rounded-lg shadow-lg border border-border overflow-hidden z-50',
        'animate-in fade-in-0 zoom-in-95',
        className
      )}
    >
      <div className="p-3 border-b border-border flex items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search GIFs..."
            className="pl-8 pr-8 h-9 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full w-8 text-muted-foreground hover:bg-transparent"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button variant="ghost" size="icon" className="ml-2 h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-80 overflow-y-auto p-2">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : gifs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
            {isSearching ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <p>Searching GIFs...</p>
              </>
            ) : (
              <p>No GIFs found. Try a different search term.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {!searchQuery && (
              <div className="col-span-2 px-2 py-1 text-xs text-muted-foreground flex items-center">
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                {isSearching ? 'Searching...' : 'Trending'}
              </div>
            )}
            {gifs.map((gif) => (
              <div
                key={gif.id}
                role="button"
                tabIndex={0}
                className="relative aspect-square rounded-md overflow-hidden hover:ring-2 hover:ring-primary transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={() => {
                  onSelect(gif.images.original.url);
                  onClose();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(gif.images.original.url);
                    onClose();
                  }
                }}
                aria-label={`Select GIF: ${gif.title}`}
              >
                <MediaMessage
                  src={gif.images.fixed_width.url}
                  alt={gif.title || 'GIF'}
                  isGif={true}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
