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
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={post.userAvatarUrl || undefined} />
            <AvatarFallback>{post.userName?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-medium">{post.userName}</div>
            <CardDescription className="text-xs text-muted-foreground/80 mt-0.5">
              shared an experience from <Link href={planLink} className="text-primary hover:underline font-medium">{plan.name}</Link> - {postedAtRelative}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {post.text && (
          <p className="text-sm mb-4">{post.text}</p>
        )}

        {post.mediaUrl && (
          <div className="relative aspect-[16/9] rounded-lg overflow-hidden mb-4">
            <Image
              src={post.mediaUrl}
              alt="Post image"
              fill
              className="object-cover"
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
              <Heart className="mr-1.5 h-4 w-4" />
              <span className="text-xs">{post.likesCount || 0}</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
              <MessageCircle className="mr-1.5 h-4 w-4" />
              <span className="text-xs">{post.commentsCount || 0}</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
              <Share className="mr-1.5 h-4 w-4" />
              <span className="text-xs">{post.sharesCount || 0}</span>
            </Button>
          </div>

          <Button variant="ghost" size="sm" asChild>
            <Link href={planLink} className="text-muted-foreground hover:text-primary text-xs">
              <ExternalLink className="mr-1.5 h-4 w-4" /> View Plan
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 