'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ExternalLink, Heart, MessageCircle, Share } from 'lucide-react';
import type { FeedPost, Plan } from '@/types/user';
import { useAuth } from '@/context/AuthContext';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface FeedPostCardProps {
  post: FeedPost;
  plan: Plan;
}

export function FeedPostCard({ post, plan }: FeedPostCardProps) {
  const { user } = useAuth();
  const isParticipant = user?.uid && (
    plan.hostId === user.uid || 
    plan.invitedParticipantUserIds?.includes(user.uid)
  );

  // Determine the correct link based on user's relationship to the plan
  const planLink = isParticipant ? `/plans/${plan.id}` : `/p/${plan.id}`;
  
  // Handle timestamp conversion
  const postedAtRelative = typeof post.createdAt === 'string' 
    ? formatDistanceToNow(parseISO(post.createdAt), { addSuffix: true }) 
    : '';

  return (
    <Card className="overflow-hidden border-0 shadow-sm rounded-xl">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8 border border-border/20">
            <AvatarImage src={post.userAvatarUrl || undefined} />
            <AvatarFallback>{(post.username?.[0] || post.userName?.[0])?.toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-medium text-sm">{post.username || post.userName}</div>
            <CardDescription className="text-xs text-muted-foreground/70 mt-0">
              {postedAtRelative} • {post.location || 'Bekasi'}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <span className="sr-only">More options</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3.5C8.82843 3.5 9.5 2.82843 9.5 2C9.5 1.17157 8.82843 0.5 8 0.5C7.17157 0.5 6.5 1.17157 6.5 2C6.5 2.82843 7.17157 3.5 8 3.5Z" fill="currentColor"/>
              <path d="M8 9.5C8.82843 9.5 9.5 8.82843 9.5 8C9.5 7.17157 8.82843 6.5 8 6.5C7.17157 6.5 6.5 7.17157 6.5 8C6.5 8.82843 7.17157 9.5 8 9.5Z" fill="currentColor"/>
              <path d="M8 15.5C8.82843 15.5 9.5 14.8284 9.5 14C9.5 13.1716 8.82843 12.5 8 12.5C7.17157 12.5 6.5 13.1716 6.5 14C6.5 14.8284 7.17157 15.5 8 15.5Z" fill="currentColor"/>
            </svg>
          </Button>
        </div>
      </CardHeader>

      {post.text && (
        <div className="px-4 pb-2">
          <p className="text-sm">{post.text}</p>
        </div>
      )}

      {post.mediaUrl && (
        <div className="relative aspect-square w-full overflow-hidden">
          <Image
            src={post.mediaUrl}
            alt="Post image"
            fill
            className="object-cover"
          />
        </div>
      )}

      <CardContent className="pt-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-5">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary p-0 h-auto">
              <Heart className="mr-1.5 h-5 w-5" fill="none" />
              <span className="text-xs font-medium">{post.likesCount || 349}</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary p-0 h-auto">
              <MessageCircle className="mr-1.5 h-5 w-5" fill="none" />
              <span className="text-xs font-medium">{post.commentsCount || 760}</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary p-0 h-auto">
              <Share className="h-5 w-5" fill="none" />
            </Button>
          </div>

          <Button variant="ghost" size="sm" className="p-0 h-auto">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 5C5 4.44772 5.44772 4 6 4H18C18.5523 4 19 4.44772 19 5V21L12 17.5L5 21V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Button>
        </div>
        
        {post.text && (
          <div className="mt-1">
            <span className="text-sm font-medium">{post.username || post.userName}</span>
            <span className="text-sm ml-2">{post.text}</span>
            {post.text.length > 50 && (
              <button className="text-muted-foreground text-xs ml-1">... more</button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 