'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ArrowTopRightOnSquareIcon, GlobeAltIcon, LinkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { getDomain, isImageUrl, isVideoUrl, detectUrls } from '@/lib/linkUtils';

// Map of common domains to their favicon URLs
const FAVICON_MAP: { [key: string]: string } = {
  'youtube.com': 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64',
  'youtu.be': 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64',
  'twitter.com': 'https://www.google.com/s2/favicons?domain=twitter.com&sz=64',
  'x.com': 'https://www.google.com/s2/favicons?domain=x.com&sz=64',
  'instagram.com': 'https://www.google.com/s2/favicons?domain=instagram.com&sz=64',
  'facebook.com': 'https://www.google.com/s2/favicons?domain=facebook.com&sz=64',
  'linkedin.com': 'https://www.google.com/s2/favicons?domain=linkedin.com&sz=64',
  'github.com': 'https://www.google.com/s2/favicons?domain=github.com&sz=64',
  'reddit.com': 'https://www.google.com/s2/favicons?domain=reddit.com&sz=64',
  'discord.com': 'https://www.google.com/s2/favicons?domain=discord.com&sz=64',
  'tiktok.com': 'https://www.google.com/s2/favicons?domain=tiktok.com&sz=64',
  'spotify.com': 'https://www.google.com/s2/favicons?domain=spotify.com&sz=64',
};

interface LinkPreviewProps {
  url: string;
  className?: string;
  onLoad?: () => void;
}

interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  video?: {
    url: string;
    type: string;
    html?: string;
  };
  audio?: string;
}

interface PlatformEmbed {
  type: string;
  url: string;
  aspect: string;
  minAspect?: string; // For responsive embeds
  maxAspect?: string;  // For responsive embeds
  isShort?: boolean;   // For YouTube Shorts
}

export function LinkPreview({ url, className, onLoad }: LinkPreviewProps) {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const domain = getDomain(url);

  const getPlatformEmbed = (url: string): PlatformEmbed | null => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;
      const searchParams = new URLSearchParams(urlObj.search);

      // YouTube
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        const videoId = searchParams.get('v') || pathname.split('/').pop();
        const isShort = pathname.includes('/shorts/') || pathname.includes('/live/');
        
        return {
          type: 'youtube',
          url: `https://www.youtube.com/embed/${videoId}?autoplay=0&showinfo=0&rel=0`,
          aspect: isShort ? '9/16' : '16/9',
          isShort: isShort
        };
      }

      // TikTok
      if (hostname.includes('tiktok.com')) {
        // Extract video ID from URL
        let videoId = pathname.split('/').pop();
        // Handle tiktok.com/@username/video/123456789 format
        if (pathname.includes('/video/')) {
          videoId = pathname.split('/video/')[1].split('?')[0];
        }
        
        // Build TikTok embed URL with custom parameters
        const params = new URLSearchParams({
          // Basic parameters
          lang: 'en',
          // Player appearance
          hide_cover: '1',  // Hide the cover to remove the play button overlay
          hide_author: '0',
          hide_like: '1',
          hide_share: '1',
          // Theme and appearance
          theme: 'dark',
          // Disable redirects and external navigation
          disable_redirect: '1',
          no_redirect: '1',
          // Autoplay settings
          autoplay: '1',
          // Mobile behavior
          is_from_webapp: '1',
          is_copy_link: '0',
          // Embed settings
          embed_from: 'oembed',
          embed_version: '1',
          // Player controls
          show_comments: '0',
          // Domain verification
          referer: typeof window !== 'undefined' ? window.location.origin : '',
          // Video settings
          is_embed: '1',
          is_video: '1',
          // Disable other UI elements
          hide_cover_play_button: '1',
          hide_play_button: '1',
          hide_play_icon: '1',
          // Disable tracking
          enable_embed: '1',
          enable_web_component: '1'
        });
        
        const embedUrl = `https://www.tiktok.com/embed/v2/${videoId}?${params.toString()}`;
        
        return {
          type: 'tiktok',
          url: embedUrl,
          aspect: '9/16',
          isShort: true
        };
      }

      // Instagram
      if (hostname.includes('instagram.com')) {
        const postId = pathname.split('/').filter(Boolean).pop();
        // Use a standard aspect ratio that works well for most Instagram posts
        return {
          type: 'instagram',
          url: `https://www.instagram.com/p/${postId}/embed/captioned/`,
          aspect: '1/1.25' // Slightly taller than square to accommodate captions
        };
      }

      // Twitter
      if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        const tweetId = pathname.split('/').pop();
        return {
          type: 'twitter',
          url: `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}`,
          aspect: '16/9'
        };
      }

      // Facebook
      if (hostname.includes('facebook.com') || hostname.includes('fb.watch')) {
        return {
          type: 'facebook',
          url: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=true`,
          aspect: '16/9'
        };
      }

      // Spotify
      if (hostname.includes('spotify.com')) {
        // Remove any locale segments like 'intl-fr' from the path
        const cleanPath = pathname.replace(/^\/(intl-[a-z]{2})\//, '/');
        const pathParts = cleanPath.split('/').filter(Boolean);
        const type = pathParts[0];
        const id = pathParts[1]?.split('?')[0];
        if (type && id) {
          return {
            type: 'spotify',
            url: `https://open.spotify.com/embed/${type}/${id}`,
            aspect: type === 'track' ? '16/3' : '16/9'
          };
        }
      }

      // SoundCloud
      if (hostname.includes('soundcloud.com')) {
        return {
          type: 'soundcloud',
          url: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`,
          aspect: '16/4'
        };
      }

      // Vimeo
      if (hostname.includes('vimeo.com')) {
        const videoId = pathname.split('/').pop();
        return {
          type: 'vimeo',
          url: `https://player.vimeo.com/video/${videoId}`,
          aspect: '16/9'
        };
      }

      // Twitch
      if (hostname.includes('twitch.tv')) {
        const [type, channel] = pathname.split('/').filter(Boolean);
        if (type === 'videos') {
          const videoId = channel;
          return {
            type: 'twitch',
            url: `https://player.twitch.tv/?video=${videoId}&parent=${typeof window !== 'undefined' ? window.location.hostname : ''}`,
            aspect: '16/9'
          };
        }
        return {
          type: 'twitch',
          url: `https://player.twitch.tv/?channel=${channel}&parent=${typeof window !== 'undefined' ? window.location.hostname : ''}`,
          aspect: '16/9'
        };
      }

      // Reddit
      if (hostname.includes('reddit.com')) {
        return {
          type: 'reddit',
          url: `https://www.redditmedia.com/${pathname}?ref_source=embed&ref=share&embed=true`,
          aspect: '16/9'
        };
      }

      // Pinterest
      if (hostname.includes('pinterest.')) {
        const pinId = pathname.split('/pin/')[1]?.split('/')[0];
        if (pinId) {
          return {
            type: 'pinterest',
            url: `https://assets.pinterest.com/ext/embed.html?id=${pinId}`,
            aspect: '1/1'
          };
        }
      }

      // GitHub (Gists)
      if (hostname.includes('gist.github.com')) {
        const [user, gistId] = pathname.split('/').filter(Boolean);
        return {
          type: 'github',
          url: `https://gist.github.com/${user}/${gistId}.pibb`,
          aspect: '16/9'
        };
      }

      // CodePen
      if (hostname.includes('codepen.io')) {
        const parts = pathname.split('/').filter(Boolean);
        const [user, , penId] = parts;
        return {
          type: 'codepen',
          url: `https://codepen.io/${user}/embed/${penId}?default-tab=result`,
          aspect: '16/9'
        };
      }

      // Figma
      if (hostname.includes('figma.com')) {
        const fileId = pathname.split('/file/')[1]?.split('/')[0];
        if (fileId) {
          return {
            type: 'figma',
            url: `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`,
            aspect: '16/9'
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error generating embed URL:', error);
      return null;
    }
  };

  const fetchMetadata = async () => {
    if (!url) return;

    const embed = getPlatformEmbed(url);
    if (embed) {
      // For video platforms, try to fetch additional metadata
      if (['youtube', 'vimeo', 'tiktok', 'twitch'].includes(embed.type)) {
        try {
          // Handle TikTok specially - extract video ID and use noembed
          if (embed.type === 'tiktok') {
            const videoId = url.split('/').pop()?.split('?')[0];
            if (videoId) {
              try {
                // First try to get basic metadata
                const response = await fetch(`https://www.tiktok.com/oembed?url=https://www.tiktok.com/@tiktok/video/${videoId}`);
                if (response.ok) {
                  const data = await response.json();
                  setMetadata({
                    title: data.title || 'TikTok Video',
                    description: data.author_name ? `by ${data.author_name}` : '',
                    image: data.thumbnail_url,
                    siteName: 'TikTok',
                    video: {
                      url: `https://www.tiktok.com/embed/v2/${videoId}`,
                      type: 'video/mp4',
                      html: data.html // Store the embed HTML as fallback
                    }
                  });
                  setIsLoading(false);
                  onLoad?.();
                  return;
                }
              } catch (error) {
                console.error('Error fetching TikTok metadata:', error);
              }
            }
          }
          // Use oEmbed API for YouTube
          if (embed.type === 'youtube') {
            // Parse the URL and handle any existing query parameters
            const urlObj = new URL(url);
            const videoId = urlObj.searchParams.get('v') || url.split('/').pop();
            
            // Create a clean URL for oEmbed without any existing query parameters
            const cleanWatchUrl = `https://www.youtube.com/watch?v=${videoId}`;
            const response = await fetch(
              `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanWatchUrl)}&format=json`
            );
            if (response.ok) {
              const data = await response.json();
              setMetadata({
                title: data.title,
                description: data.author_name,
                siteName: 'YouTube',
                video: {
                  url: url,
                  type: 'video/mp4'
                }
              });
              setIsLoading(false);
              onLoad?.();
              return;
            }
          }
          // Use Vimeo oEmbed API
          else if (embed.type === 'vimeo') {
            const videoId = url.split('/').pop();
            const response = await fetch(
              `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`
            );
            if (response.ok) {
              const data = await response.json();
              setMetadata({
                title: data.title,
                description: data.author_name,
                image: data.thumbnail_url,
                siteName: 'Vimeo',
                video: {
                  url: url,
                  type: 'video/mp4'
                }
              });
              setIsLoading(false);
              onLoad?.();
              return;
            }
          }
        } catch (error) {
          console.error('Error fetching video metadata:', error);
          // Fall through to default embed handling
        }
      }
      
      // Default embed handling if no specific metadata fetched
      setMetadata({
        title: url,
        siteName: embed.type.charAt(0).toUpperCase() + embed.type.slice(1)
      });
      setIsLoading(false);
      onLoad?.();
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Use Microlink API for rich previews
      const response = await fetch(
        `https://api.microlink.io/?url=${encodeURIComponent(url)}&audio=1&video=1&iframe=1&palette=1`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch link metadata');
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setMetadata({
          title: data.data.title || data.data.url,
          description: data.data.description,
          image: data.data.image?.url,
          siteName: data.data.publisher || new URL(data.data.url).hostname.replace('www.', ''),
          video: data.data.video,
          audio: data.data.audio
        });
      } else {
        throw new Error('No metadata available');
      }
    } catch (err) {
      console.error('Error fetching link metadata:', err);
      setError('Could not load preview');
    } finally {
      setIsLoading(false);
      onLoad?.();
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [url]);

  const embed = getPlatformEmbed(url);

  if (isLoading) {
    return (
      <div className={cn("w-full max-w-md rounded-lg border bg-muted/20 p-3", className)}>
        <div className="flex items-center space-x-2">
          <div className="h-4 w-4 animate-pulse rounded-full bg-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (error || !metadata) {
    return null;
  }

  // Special handling for TikTok - show image with play button instead of iframe
  if (embed?.type === 'tiktok' && metadata?.image) {
    return (
      <div className={cn("w-full max-w-md overflow-hidden rounded-lg border bg-background/80 group", className)}>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="block"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative" style={{ aspectRatio: '9/16' }}>
            <Image
              src={metadata.image}
              alt={metadata.title || 'TikTok video'}
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
              <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500 ml-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground line-clamp-2">
                  {metadata.title}
                </h3>
                {metadata.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {metadata.description}
                  </p>
                )}
              </div>
              <div className="ml-2 flex-shrink-0 flex items-center">
                <svg className="h-4 w-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0119 3a9 9 0 01-9 9 4.288 4.288 0 01-2.82-1.4c-.5-.5-1.18-.5-1.68 0-.5.5-.5 1.18 0 1.68 1 1 2.38 1.66 4 1.91v1.5h-1.5v2h1.5v1h2v-1h1.5v-2h-1.5v-1.57c1.71-.29 3.25-1.26 4.25-2.68.5-.5.5-1.18 0-1.68-.5-.5-1.18-.5-1.68 0z" />
                  <path d="M9 17a1 1 0 100-2 1 1 0 000 2z" />
                </svg>
              </div>
            </div>
          </div>
        </a>
      </div>
    );
  }

  // Return just the embed for music players and Twitter without the preview UI
  if (embed && ['spotify', 'soundcloud', 'twitter'].includes(embed.type)) {
    // Calculate responsive height based on viewport width and embed type
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    let height = '500'; // Default height for Twitter
    let playerUrl = embed.url;
    
    // Platform-specific URL and height adjustments
    if (embed.type === 'spotify') {
      height = isMobile ? '80' : '152';
      playerUrl = `${embed.url}${embed.url.includes('?') ? '&' : '?'}utm_source=generator&theme=1`;
    } else if (embed.type === 'twitter') {
      // For Twitter, use the Twitter embed API with minimal options and dark theme
      playerUrl = `${embed.url}${embed.url.includes('?') ? '&' : '?'}hide_thread=true&theme=dark&chrome=nofooter%20noborders%20transparent`;
      height = '500'; // Fixed height for Twitter embeds
    }
    
    return (
      <div 
        className={cn(
          "w-full max-w-md overflow-hidden rounded-2xl",
          {
            'bg-black': embed.type === 'twitter',
            'bg-[#181818] min-h-[80px]': embed.type !== 'twitter'
          },
          className
        )}
        style={{
          maxWidth: '100%',
          // Remove fixed aspect ratio to allow natural height
        }}
      >
        <div className="relative w-full" style={{ 
          paddingBottom: embed.type === 'twitter' ? '0' : '80px',
          height: embed.type === 'twitter' ? height + 'px' : 'auto'
        }}>
          <iframe
            src={playerUrl}
            className="absolute top-0 left-0 w-full h-full"
            frameBorder="0"
            loading="lazy"
            // Combine all necessary permissions
            allow={`${embed.type === 'twitter' ? '' : 'autoplay; '}clipboard-write; encrypted-media; fullscreen; picture-in-picture; accelerometer; gyroscope`}
            // Set background to transparent via style
            style={{
              ...(embed.type === 'twitter' ? { background: 'transparent' } : {}),
              minHeight: embed.type === 'twitter' ? '300px' : '80px',
              maxHeight: embed.type === 'twitter' ? '1000px' : '352px',
              borderRadius: '16px',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}
          />
        </div>
      </div>
    );
  }

  // For all other embeds, show with preview UI
  return (
    <div className={cn("w-full max-w-md overflow-hidden rounded-lg border bg-background/80", className)}>
      {embed ? (
        <div 
          className={`relative w-full overflow-hidden rounded-lg ${
            embed.type === 'youtube' && embed.isShort ? 'youtube-short' : ''
          }`}
          style={{ 
            aspectRatio: embed.aspect,
            width: embed.type === 'youtube' && embed.isShort ? '350px' : '100%',
            height: embed.type === 'youtube' && embed.isShort ? '600px' : 'auto',
            margin: '0 auto',
            minHeight: embed.type === 'youtube' ? '0' : '450px' // Only apply min-height to non-YouTube embeds
          }}
        >
          {embed.type === 'tiktok' ? (
            <div className="w-full h-full relative">
              <div className="absolute inset-0 z-10 pointer-events-none"></div>
              <div className="absolute inset-0 overflow-hidden rounded-lg">
                <iframe
                  src={embed.url}
                  className="w-full h-full"
                  frameBorder="0"
                  allowFullScreen
                  scrolling="no"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  style={{
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    overflow: 'hidden',
                    pointerEvents: 'auto'
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  title="TikTok video player"
                />
              </div>
            </div>
          ) : ['instagram', 'twitter', 'facebook'].includes(embed.type) ? (
            <iframe
              src={embed.url}
              className="w-full h-full"
              frameBorder="0"
              scrolling="no"
              allowFullScreen
            />
          ) : (
            <iframe
              src={embed.url}
              className="w-full h-full"
              frameBorder="0"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          )}
        </div>
      ) : metadata.video?.url ? (
        <video
          src={metadata.video.url}
          controls
          className="w-full rounded-t-lg"
        />
      ) : metadata.image ? (
        <div className="relative h-48 w-full">
          <Image
            src={metadata.image}
            alt={metadata.title || 'Preview image'}
            fill
            className="object-cover"
            unoptimized={!metadata.image.startsWith('https')}
          />
        </div>
      ) : null}

      {!['instagram', 'youtube'].includes(embed?.type || '') && (
        <div className="p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm font-medium text-foreground hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {metadata.title || domain}
              </a>
              {metadata.description && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {metadata.description}
                </p>
              )}
            </div>
            <ArrowTopRightOnSquareIcon className="ml-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          </div>
          
          {metadata.siteName && (
            <div className="mt-2 flex items-center">
              <span className="text-xs text-muted-foreground">{metadata.siteName}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Renders text with clickable links and returns any link previews separately
 */
// Separate component for rendering a single link
function LinkItem({ url, index }: { url: string; index: number }) {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.title) {
            setMetadata(data);
          }
        }
      } catch (error) {
        console.error('Error fetching link metadata:', error);
      }
    };
    
    fetchMetadata();
  }, [url]);
  
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const favicon = FAVICON_MAP[domain] || `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    
    // Default to domain name
    let pageName = domain;
    
    // For Spotify links, use the track ID as a fallback (better than domain)
    if (domain.includes('spotify.com')) {
      const spotifyId = urlObj.pathname.split('/').pop();
      if (spotifyId) {
        pageName = spotifyId;
      }
    }
    
    // Use metadata title if available
    if (metadata?.title) {
      pageName = metadata.title;
    }
    
    return (
      <a 
        key={`url-${index}`}
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="inline-flex items-center bg-muted hover:bg-muted/80 text-foreground rounded-full px-2.5 py-0.5 text-sm font-medium transition-colors mx-0.5 my-0.5 border border-border hover:border-foreground/20"
        onClick={(e) => e.stopPropagation()}
        style={{
          lineHeight: '1.25',
          whiteSpace: 'nowrap',
          maxWidth: '220px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          verticalAlign: 'middle',
          textDecoration: 'none'
        }}
      >
        <img 
          src={favicon} 
          alt="" 
          className="h-3 w-3 mr-1.5 flex-shrink-0"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
        <span className="truncate">{pageName}</span>
        <ArrowTopRightOnSquareIcon className="h-2.5 w-2.5 ml-1.5 opacity-70 flex-shrink-0" />
      </a>
    );
  } catch (e) {
    // Fallback to simple link if URL parsing fails
    return (
      <a 
        key={`url-${index}`}
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="inline-flex items-center bg-muted hover:bg-muted/80 text-foreground rounded-full px-2.5 py-0.5 text-sm font-medium transition-colors mx-0.5 my-0.5 border border-border hover:border-foreground/20"
        onClick={(e) => e.stopPropagation()}
      >
        <LinkIcon className="h-3 w-3 mr-1.5 flex-shrink-0" />
        <span className="truncate">Link</span>
        <ArrowTopRightOnSquareIcon className="h-2.5 w-2.5 ml-1.5 opacity-70 flex-shrink-0" />
      </a>
    );
  }
}

export function TextWithLinkPreviews({ 
  text, 
  className, 
  onPreviewLoad 
}: { 
  text: string; 
  className?: string;
  onPreviewLoad?: (hasPreview: boolean) => void;
}) {
  const urls = detectUrls(text);
  
  if (!text) return { textContent: null, preview: null };

  // Simple linkification for text with pill buttons
  const parts = [];
  let lastIndex = 0;
  
  urls.forEach((url, index) => {
    const urlIndex = text.indexOf(url, lastIndex);
    if (urlIndex > lastIndex) {
      parts.push(text.substring(lastIndex, urlIndex));
    }
    
    parts.push(<LinkItem key={`link-${index}`} url={url} index={index} />);
    lastIndex = urlIndex + url.length;
  });
  
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  // Create the preview component if URL exists
  const preview = urls.length > 0 ? (
    <div className="max-w-full">
      <LinkPreview 
        url={urls[0]} 
        className="max-w-full"
        onLoad={() => onPreviewLoad?.(true)}
      />
    </div>
  ) : null;

  // Return text content with clickable links
  const textContent = parts.length > 0 ? (
    <div className={cn("whitespace-pre-wrap mt-1", className)}>
      {parts}
    </div>
  ) : null;

  return { textContent, preview };
}
