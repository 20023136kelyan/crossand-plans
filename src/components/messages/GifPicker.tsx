'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowPathIcon, MagnifyingGlassIcon, XCircleIcon, ArrowTrendingUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { searchGifs, getTrendingGifs, type GifObject } from '@/lib/giphy';
import { MediaMessage } from './MediaMessage';
import { cn } from '@/lib/utils';

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
  className?: string;
  isOpen?: boolean;
}

export function GifPicker({ onSelect, onClose, className, isOpen = true }: GifPickerProps) {
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

  // Handle click outside to close the picker
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      console.log('[GifPicker] Click detected');
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        console.log('[GifPicker] Click outside detected, calling onClose');
        onClose();
      } else {
        console.log('[GifPicker] Click inside picker, not closing');
      }
    };

    // Use a slight delay to ensure the event is attached after the click that opened the picker
    const timer = setTimeout(() => {
      console.log('[GifPicker] Adding click outside listener');
      document.addEventListener('click', handleClickOutside, true); // Use capture phase
    }, 100);

    return () => {
      clearTimeout(timer);
      console.log('[GifPicker] Removing click outside listener');
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [onClose, isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('[GifPicker] Escape key pressed, calling onClose');
        onClose();
      }
    };

    console.log('[GifPicker] Adding Escape key listener');
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      console.log('[GifPicker] Removing Escape key listener');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!isOpen) {
    console.log('[GifPicker] Not rendering picker (closed)');
    return null;
  }

  console.log('[GifPicker] Rendering picker');
  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed inset-x-0 bottom-0 w-full max-w-4xl h-[45vh] max-h-[400px] bg-background border-t rounded-t-lg shadow-2xl overflow-hidden flex flex-col z-50 mb-2",
        className
      )}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          console.log('[GifPicker] Escape key pressed, calling onClose');
          onClose();
        }
      }}
    >
      <div className="p-3 border-b border-border flex items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
              <XCircleIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button variant="ghost" size="icon" className="ml-2 h-8 w-8" onClick={onClose}>
          <XMarkIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 will-change-transform">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : gifs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
            {isSearching ? (
              <>
                <ArrowPathIcon className="h-8 w-8 animate-spin mb-2" />
                <p>Searching GIFs...</p>
              </>
            ) : (
              <p>No GIFs found. Try a different search term.</p>
            )}
          </div>
        ) : (
          <div className="columns-3 gap-1 space-y-1">
            {!searchQuery && (
              <div className="col-span-2 px-2 py-1 text-xs text-muted-foreground flex items-center">
                <ArrowTrendingUpIcon className="h-3.5 w-3.5 mr-1.5" />
                {isSearching ? 'Searching...' : 'Trending'}
              </div>
            )}
            {Array.from(new Map(gifs.map(gif => [gif.id, gif])).values()).map((gif) => {
              // Main click handler for the GIF
              const handleGifClick = (e: React.MouseEvent) => {
                console.log('[GifPicker] Main GIF click handler triggered');
                e.preventDefault();
                e.stopPropagation();
                console.log('[GifPicker] GIF clicked:', gif);
                console.log('[GifPicker] Calling onSelect with URL:', gif.images.original.url);
                onSelect(gif.images.original.url);
                onClose();
              };

              // Keyboard handler for accessibility
              const handleKeyDown = (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  console.log('[GifPicker] GIF selected with keyboard:', gif);
                  console.log('[GifPicker] Calling onSelect with URL:', gif.images.original.url);
                  onSelect(gif.images.original.url);
                  onClose();
                }
              };

              return (
                <div
                  key={gif.id}
                  role="button"
                  tabIndex={0}
                  className="relative rounded-md overflow-hidden hover:ring-2 hover:ring-primary transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer break-inside-avoid mb-1.5 w-full will-change-transform"
                  style={{ 
                    pointerEvents: 'auto',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                  onClick={handleGifClick}
                  onKeyDown={handleKeyDown}
                  onMouseDown={(e) => {
                    console.log('[GifPicker] Mouse down on GIF');
                    e.stopPropagation();
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                  }}
                  aria-label={`Select GIF: ${gif.title}`}
                >
                  <div className="w-full">
                    <MediaMessage
                      src={gif.images.fixed_width.url}
                      alt={gif.title || 'GIF'}
                      className="w-full h-auto max-w-full max-h-[180px] object-cover rounded-md block will-change-transform transform-gpu"
                      isGif
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
