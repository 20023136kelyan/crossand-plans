'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string | Blob;
  className?: string;
  duration?: number;
  isSender?: boolean;
  compact?: boolean;
}

export function AudioPlayer({ 
  src, 
  className = '', 
  duration: propDuration, 
  isSender = true, 
  compact = false 
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [objectUrl, setObjectUrl] = useState('');

  // Create object URL for blob sources
  useEffect(() => {
    if (src instanceof Blob) {
      const url = URL.createObjectURL(src);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setObjectUrl('');
    }
  }, [src]);

  // Set duration from prop if available
  useEffect(() => {
    if (propDuration && !isNaN(propDuration) && isFinite(propDuration)) {
      setDuration(propDuration);
    }
  }, [propDuration]);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    
    // Load the audio source
    const audioSrc = objectUrl || (typeof src === 'string' ? src : '');
    audio.src = audioSrc;
    
    const updateTime = () => {
      if (audio.readyState > 0) {
        setCurrentTime(audio.currentTime);
      }
    };
    
    const handleLoadedData = () => {
      // Always try to get duration from audio element if not provided
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      } else if (propDuration && !isNaN(propDuration) && isFinite(propDuration)) {
        setDuration(propDuration);
      } else {
        // If we can't get duration, set a default and try to calculate it
        audio.oncanplaythrough = () => {
          if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
            setDuration(audio.duration);
          }
        };
      }
      setIsReady(true);
    };
    
    const handleDurationChange = () => {
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      } else if (propDuration && !isNaN(propDuration) && isFinite(propDuration)) {
        setDuration(propDuration);
      }
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    
    // Initial load
    audio.load();
    
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [src, objectUrl]);

  // Handle play/pause
  const togglePlayPause = () => {
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Handle seeking on progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !audioRef.current) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Format time as MM:SS
  const formatTime = (time: number) => {
    console.log('formatTime called with:', time, 'type:', typeof time);
    if (isNaN(time) || !isFinite(time) || time < 0 || time === Infinity) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const result = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    console.log('formatTime result:', result);
    return result;
  };

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn('flex items-center w-full', className)}>
      <Button
        variant="ghost"
        size={compact ? 'icon' : 'icon'}
        onClick={togglePlayPause}
        disabled={!isReady}
        className={cn(
          'flex-shrink-0 rounded-full',
          compact ? 'h-8 w-8' : 'h-10 w-10 bg-background/50 hover:bg-background/70'
        )}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className={compact ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
        ) : (
          <Play className={compact ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
        )}
      </Button>
      
      <div className={cn(compact ? 'flex-1 min-w-0 mx-2' : 'flex-1 flex items-center gap-2')}>
        <div className={cn('flex-1', compact ? '' : 'w-32')}>
          <div 
            ref={progressBarRef}
            className={cn(
              'h-2.5 bg-muted/50 rounded-full overflow-hidden cursor-pointer group relative',
              compact ? 'h-1.5 w-full' : 'w-full'
            )}
            onClick={handleProgressClick}
          >
            <div 
              className={cn(
                'h-full transition-all duration-300 ease-out group-hover:opacity-90 rounded-full',
                isSender ? 'bg-[#23232a]' : 'bg-[#d97a1a]'
              )}
              style={{ width: `${progress}%` }}
            />
            {!compact && (
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
                  pointerEvents: 'none'
                }}
              />
            )}
          </div>
        </div>
        {!compact && (
          <div className="px-2 flex items-center justify-center bg-muted/30 rounded-full text-xs text-muted-foreground min-w-[2.5rem] leading-none h-5">
            {formatTime(duration - currentTime)}
          </div>
        )}
      </div>
    </div>
  );
}
