'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AudioPlayerProps {
  src: string | Blob;
  className?: string;
  duration?: number;
}

export function AudioPlayer({ src, className = '', duration: propDuration }: AudioPlayerProps) {
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
  const togglePlayPause = async () => {
    if (!audioRef.current) return;
    
    try {
      if (isPlaying) {
        await audioRef.current.pause();
      } else {
        await audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
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
    <div className={`flex items-center w-full ${className}`} style={{ minWidth: '250px' }}>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-full flex-shrink-0 bg-background/50 hover:bg-background/70"
        onClick={togglePlayPause}
        disabled={!isReady}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5" />
        )}
      </Button>
      
      <div className="flex items-center ml-2 flex-1 min-w-0">
        <div className="flex-1 min-w-0 mr-4">
          <div 
            ref={progressBarRef}
            className="h-2.5 w-full bg-muted/50 rounded-full overflow-hidden cursor-pointer group relative"
            onClick={handleProgressClick}
          >
            <div 
              className="h-full bg-primary transition-all duration-300 ease-out group-hover:bg-primary/90 rounded-full"
              style={{ width: `${progress}%` }}
            />
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
                pointerEvents: 'none'
              }}
            />
          </div>
        </div>
        <div className="bg-accent/80 rounded-full px-2.5 py-0.5">
          <div className="text-xs font-medium text-nowrap text-foreground/80">
            {isPlaying ? (
              <span>-{formatTime(duration - currentTime)}</span>
            ) : (
              <span>{formatTime(duration)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
