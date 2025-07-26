'use client';

import { useState, useEffect, useRef } from 'react';
import NextImage from 'next/image';
import { cn } from '@/lib/utils';
import { Play, Pause, Loader2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AudioPlayer } from './AudioPlayer';

interface MediaMessageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  isGif?: boolean;
  isVoice?: boolean;
  voiceDuration?: number;
  onClick?: () => void;
}

export function MediaMessage({ 
  src, 
  alt, 
  width = 280, 
  height = 350, 
  className = '',
  isGif = false,
  isVoice = false,
  voiceDuration,
  onClick
}: MediaMessageProps) {
  const [isPlaying, setIsPlaying] = useState(!isGif); // Autoplay non-GIFs by default
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const mediaRef = useRef<HTMLDivElement>(null);
  const isGifFile = isGif || src.toLowerCase().endsWith('.gif');
  const isVideo = src.toLowerCase().match(/\.(mp4|webm|ogg)$/);
  const isAudio = isVoice || src.toLowerCase().match(/\.(mp3|wav|ogg|webm)$/);
  
  // Toggle play/pause for GIFs
  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGifFile) {
      setIsPlaying(!isPlaying);
    } else if (onClick) {
      onClick();
    }
  };

  // Handle click outside to hide controls
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mediaRef.current && !mediaRef.current.contains(event.target as Node)) {
        setShowControls(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard controls
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setIsPlaying(!isPlaying);
    }
  };

  // Render appropriate media element
  const renderMedia = () => {
    if (isAudio) {
      return (
        <div className="w-full max-w-[280px]">
          <AudioPlayer 
            src={src} 
            className="w-full" 
            duration={voiceDuration ? Number(voiceDuration) : undefined}
          />
        </div>
      );
    }
    
    if (isVideo) {
      return (
        <video
          src={src}
          className="w-full h-full object-contain max-h-[350px] rounded-md"
          controls={false}
          autoPlay={isPlaying}
          loop
          muted
          playsInline
        />
      );
    }

    return (
      <div className="relative w-full h-full overflow-hidden rounded-md">
        <NextImage
          src={src}
          alt={alt}
          width={width}
          height={height}
          className={cn(
            'object-cover w-full h-full cursor-pointer transition-opacity',
            !isPlaying && isGifFile ? 'opacity-80' : 'opacity-100',
            className
          )}
          unoptimized={isGifFile || !src.startsWith('http') || 
                     src.includes('placehold.co') || 
                     src.includes('firebasestorage.googleapis.com')}
          onLoad={() => setIsLoading(false)}
          priority={false}
          onClick={togglePlayPause}
          style={{
            contentVisibility: 'auto',
            ...(isGifFile && !isPlaying ? { filter: 'brightness(0.8)' } : {})
          }}
        />
      </div>
    );
  };

  return (
    <div 
      ref={mediaRef}
      className={cn(
        'relative inline-block overflow-hidden',
        isGifFile ? 'cursor-pointer' : '',
        isAudio ? 'w-full' : 'rounded-md',
        className
      )}
      onClick={isAudio ? undefined : togglePlayPause}
      onMouseEnter={() => !isGifFile && !isAudio && setShowControls(true)}
      onMouseLeave={() => !isGifFile && !isAudio && setShowControls(false)}
      onKeyDown={isAudio ? undefined : handleKeyDown}
      role={isAudio ? 'none' : 'button'}
      tabIndex={isAudio ? undefined : 0}
      aria-label={isAudio ? 'Voice message' : isGifFile ? 'Play/pause animation' : 'View media'}
    >
      {/* Loading overlay */}
      {isLoading && !isAudio && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-md">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Media content */}
      <div className={cn(
        'transition-opacity duration-200',
        isLoading && !isAudio ? 'opacity-0' : 'opacity-100',
        isAudio ? 'w-full' : ''
      )}>
        {isAudio && !src ? (
          <div className="flex items-center justify-center p-4 bg-muted/50 rounded-md">
            <Mic className="h-6 w-6 text-muted-foreground" />
          </div>
        ) : (
          renderMedia()
        )}
      </div>

      {/* Play/Pause Controls for GIFs */}
      {isGifFile && showControls && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-full bg-black/60 text-white hover:bg-black/70"
            onClick={togglePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6 ml-1" /> // Slight offset for play icon
            )}
          </Button>
        </div>
      )}
      
      {/* GIF Badge */}
      {isGifFile && !showControls && (
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-md">
          GIF
        </div>
      )}
    </div>
  );
}
