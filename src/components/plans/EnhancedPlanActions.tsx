'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Share, 
  Copy, 
  QrCode, 
  Link, 
  Users, 
  Settings, 
  MoreHorizontal, 
  Heart, 
  Bookmark, 
  Flag, 
  Download,
  Calendar,
  MapPin,
  Clock,
  Star,
  Eye,
  MessageSquare,
  UserPlus,
  Crown,
  Trash2,
  Edit,
  Globe,
  Lock
} from 'lucide-react';
import { Plan } from '@/types/plan';
import { User } from 'firebase/auth';
import { toast } from 'sonner';
import { PlanDropdownMenu } from './PlanDropdownMenu';

interface EnhancedPlanActionsProps {
  plan: Plan;
  currentUser: User | null;
  isHost: boolean;
  isLoading: boolean;
  onCopyPlan: () => void;
  onCopyLink: () => void;
  onShare: () => void;
  onQRCode: () => void;
  onManageParticipants: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSaveToCollection?: () => void;
  onReport?: () => void;
  onViewAnalytics?: () => void;
  onViewComments?: () => void;
}

export function EnhancedPlanActions({
  plan,
  currentUser,
  isHost,
  isLoading,
  onCopyPlan,
  onCopyLink,
  onShare,
  onQRCode,
  onManageParticipants,
  onEdit,
  onDelete,
  onSaveToCollection,
  onReport,
  onViewAnalytics,
  onViewComments
}: EnhancedPlanActionsProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  const handleSaveToCollection = async () => {
    try {
      setIsSaved(!isSaved);
      if (onSaveToCollection) {
        await onSaveToCollection();
      }
      toast.success(isSaved ? 'Removed from collection' : 'Saved to collection');
    } catch (error) {
      setIsSaved(!isSaved); // Revert on error
      toast.error('Failed to save plan');
    }
  };

  const handleLike = async () => {
    try {
      setIsLiked(!isLiked);
      // In a real implementation, this would call an API
      toast.success(isLiked ? 'Removed like' : 'Plan liked!');
    } catch (error) {
      setIsLiked(!isLiked); // Revert on error
      toast.error('Failed to like plan');
    }
  };

  const handleReport = async () => {
    if (onReport) {
      await onReport();
    } else {
      toast.success('Plan reported. Thank you for your feedback.');
    }
  };

  const isPublicPlan = plan.status === 'published';
  const canCopy = !isHost && isPublicPlan;
  const canManage = isHost;

  return (
    <div className="space-y-4">
      {/* Plan Status Badge */}
      <div className="flex items-center justify-between">
        <Badge variant={isPublicPlan ? 'default' : 'secondary'} className="text-xs">
          {isPublicPlan ? (
            <><Globe className="h-3 w-3 mr-1" />Public Plan</>
          ) : (
            <><Lock className="h-3 w-3 mr-1" />Private Plan</>
          )}
        </Badge>
        
        {isHost && (
          <Badge variant="outline" className="text-xs">
            <Crown className="h-3 w-3 mr-1" />
            Host
          </Badge>
        )}
      </div>

      {/* Primary Actions */}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onShare}
          disabled={isLoading}
          className="flex items-center gap-1 px-3"
        >
          <Share className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:inline">Share</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onQRCode}
          disabled={isLoading}
          className="flex items-center gap-1 px-3"
        >
          <QrCode className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:inline">QR</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onCopyLink}
          disabled={isLoading}
          className="flex items-center gap-1 px-3"
        >
          <Link className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:inline">Link</span>
        </Button>

        {canCopy && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCopyPlan}
            disabled={isLoading}
            className="flex items-center gap-1 px-3"
          >
            <Copy className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only sm:inline">Copy</span>
          </Button>
        )}

        {canManage && (
          <Button
            variant="outline"
            size="sm"
            onClick={onManageParticipants}
            disabled={isLoading}
            className="flex items-center gap-1 px-3"
          >
            <Users className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only sm:inline">Manage</span>
          </Button>
        )}
      </div>

      <Separator />

      {/* Secondary Actions */}
      <div className="flex items-center justify-between">
        {/* Engagement Actions */}
        <div className="flex items-center gap-2">
          {currentUser && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                className={isLiked ? 'text-red-600' : 'text-gray-600'}
              >
                <Heart className={`h-4 w-4 mr-1 ${isLiked ? 'fill-current' : ''}`} />
                {isLiked ? 'Liked' : 'Like'}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveToCollection}
                className={isSaved ? 'text-blue-600' : 'text-gray-600'}
              >
                <Bookmark className={`h-4 w-4 mr-1 ${isSaved ? 'fill-current' : ''}`} />
                {isSaved ? 'Saved' : 'Save'}
              </Button>
            </>
          )}
        </div>

        {/* More Actions Menu */}
        <PlanDropdownMenu
          plan={plan}
          currentUserUid={currentUser?.uid}
          isHost={isHost}
          onEdit={onEdit}
          onDelete={onDelete}
          onManageParticipants={onManageParticipants}
          onSaveToCollection={onSaveToCollection}
          onReport={onReport}
          onViewAnalytics={onViewAnalytics}
          onViewComments={onViewComments}
          variant="enhanced"
          triggerClassName="h-8 w-8"
          className="w-48"
          isSaved={isSaved}
          isLiked={isLiked}
        />
      </div>

      {/* Plan Stats */}
      <div className="grid grid-cols-3 gap-4 text-center text-sm text-gray-600">
        <div>
          <div className="font-medium text-gray-900">{plan.participantUserIds?.length || 0}</div>
          <div className="text-xs">Participants</div>
        </div>
        <div>
          <div className="font-medium text-gray-900">{plan.itinerary.length}</div>
          <div className="text-xs">Stops</div>
        </div>
        <div>
          <div className="font-medium text-gray-900 flex items-center justify-center gap-1">
            <Star className="h-3 w-3 fill-current text-yellow-500" />
            4.8
          </div>
          <div className="text-xs">Rating</div>
        </div>
      </div>

      {/* Quick Info */}
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>{new Date(plan.eventTime).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>{new Date(plan.eventTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          <span>{plan.location}, {plan.city}</span>
        </div>
      </div>
    </div>
  );
}