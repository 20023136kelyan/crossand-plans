'use client';

import { Plan } from '@/types/plan';
import { parseISO, isValid, isPast } from 'date-fns';
import { MoreVertical, Eye, Edit3, CheckCircle, Trash2, Share2, QrCode, Link as LinkIcon, Users, MessageSquare, Download, Flag, Bookmark, Settings, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PlanDropdownMenuProps {
  plan: Plan;
  currentUserUid: string | undefined;
  isHost: boolean;
  // Core actions
  onMarkAsCompleted?: (planId: string, planName: string) => void;
  onConfirmCompletion?: (planId: string) => void;
  onDeleteRequest?: (planId: string, planName: string) => void;
  // Share actions
  onShare?: () => void;
  onCopyLink?: () => void;
  onQRCode?: () => void;
  onShareWithFriends?: () => void;
  onShareToFeed?: () => void;
  // Additional actions
  onEdit?: () => void;
  onCopyPlan?: () => void;
  onManageParticipants?: () => void;
  onSaveToCollection?: () => void;
  onReport?: () => void;
  onViewAnalytics?: () => void;
  onViewComments?: () => void;
  // State
  isConfirmingCompletion?: boolean;
  isLoading?: boolean;
  isSaved?: boolean;
  isLiked?: boolean;
  // Styling
  className?: string;
  triggerClassName?: string;
  size?: 'sm' | 'default';
  // Variants
  variant?: 'basic' | 'enhanced' | 'hero' | 'actions';
}

export function PlanDropdownMenu({
  plan,
  currentUserUid,
  isHost,
  // Core actions
  onMarkAsCompleted,
  onConfirmCompletion,
  onDeleteRequest,
  // Share actions
  onShare,
  onCopyLink,
  onQRCode,
  onShareWithFriends,
  onShareToFeed,
  // Additional actions
  onEdit,
  onCopyPlan,
  onManageParticipants,
  onSaveToCollection,
  onReport,
  onViewAnalytics,
  onViewComments,
  // State
  isConfirmingCompletion = false,
  isLoading = false,
  isSaved = false,
  isLiked = false,
  // Styling
  className = "w-40",
  triggerClassName = "h-6 w-6",
  size = 'default',
  // Variants
  variant = 'basic'
}: PlanDropdownMenuProps) {
  
  // Check if plan can be marked as completed (host only, past event time, not already completed)
  const canMarkAsCompleted = isHost && 
    plan.eventTime && 
    isValid(parseISO(plan.eventTime)) && 
    isPast(parseISO(plan.eventTime)) && 
    plan.status !== 'completed';

  // Check if plan can be confirmed by participant (not host, plan completed, not already confirmed by this user)
  const canConfirmCompletion = !isHost && 
    plan.status === 'completed' && 
    plan.completionConfirmedBy && 
    !plan.completionConfirmedBy.includes(currentUserUid || '');

  // Check if plan can be copied (not template or user has permission)
  const canCopy = !plan.isTemplate || isHost;

  // Check if user can manage participants (host only)
  const canManage = isHost;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={`text-muted-foreground hover:text-foreground ${triggerClassName}`}
          disabled={isLoading}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={className}>
        {/* Basic Actions - Always Available */}
        <DropdownMenuItem asChild>
          <Link href={`/p/${plan.id}`} className="flex items-center text-xs cursor-pointer">
            <Eye className="mr-2 h-3.5 w-3.5" /> View Details
          </Link>
        </DropdownMenuItem>
        
        {/* Host Actions */}
        {isHost && (
          <>
            <DropdownMenuItem asChild>
              <Link href={`/plans/create?editId=${plan.id}`} className="flex items-center text-xs cursor-pointer">
                <Edit3 className="mr-2 h-3.5 w-3.5" /> Edit Plan
              </Link>
            </DropdownMenuItem>
            
            {canManage && onManageParticipants && (
              <DropdownMenuItem onClick={onManageParticipants}>
                <UserPlus className="mr-2 h-3.5 w-3.5" /> Manage Participants
              </DropdownMenuItem>
            )}
            
            {variant === 'enhanced' && (
              <DropdownMenuItem>
                <Settings className="mr-2 h-3.5 w-3.5" /> Plan Settings
              </DropdownMenuItem>
            )}
          </>
        )}
        
        {/* Completion Actions */}
        {canMarkAsCompleted && onMarkAsCompleted && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMarkAsCompleted(plan.id, plan.name);
              }}
              className="flex items-center text-xs cursor-pointer"
            >
              <CheckCircle className="mr-2 h-3.5 w-3.5" /> Mark as Completed
            </DropdownMenuItem>
          </>
        )}
        
        {canConfirmCompletion && onConfirmCompletion && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onConfirmCompletion(plan.id);
              }}
              disabled={isConfirmingCompletion}
              className="flex items-center text-xs cursor-pointer"
            >
              <CheckCircle className="mr-2 h-3.5 w-3.5" /> Confirm Completion
            </DropdownMenuItem>
          </>
        )}
        
        {/* Share Actions */}
        {(onShare || onCopyLink || onQRCode || onShareWithFriends || onShareToFeed) && (
          <>
            <DropdownMenuSeparator />
            {onShare && (
              <DropdownMenuItem onClick={onShare}>
                <Share2 className="mr-2 h-3.5 w-3.5" /> Share
              </DropdownMenuItem>
            )}
            {onCopyLink && (
              <DropdownMenuItem onClick={onCopyLink}>
                <LinkIcon className="mr-2 h-3.5 w-3.5" /> Copy Link
              </DropdownMenuItem>
            )}
            {onQRCode && (
              <DropdownMenuItem onClick={onQRCode}>
                <QrCode className="mr-2 h-3.5 w-3.5" /> QR Code
              </DropdownMenuItem>
            )}
            {onShareWithFriends && (
              <DropdownMenuItem onClick={onShareWithFriends}>
                <Users className="mr-2 h-3.5 w-3.5" /> Share with Friends
              </DropdownMenuItem>
            )}
            {onShareToFeed && (
              <DropdownMenuItem onClick={onShareToFeed}>
                <MessageSquare className="mr-2 h-3.5 w-3.5" /> Share to Feed
              </DropdownMenuItem>
            )}
          </>
        )}
        
        {/* Copy Plan Action */}
        {canCopy && onCopyPlan && (
          <DropdownMenuItem onClick={onCopyPlan}>
            <Bookmark className="mr-2 h-3.5 w-3.5" /> Copy Plan
          </DropdownMenuItem>
        )}
        
        {/* Enhanced Actions */}
        {variant === 'enhanced' && (
          <>
            {!isHost && onSaveToCollection && (
              <DropdownMenuItem onClick={onSaveToCollection}>
                <Bookmark className="mr-2 h-3.5 w-3.5" />
                {isSaved ? 'Remove from Collection' : 'Save to Collection'}
              </DropdownMenuItem>
            )}
            
            <DropdownMenuItem>
              <Download className="mr-2 h-3.5 w-3.5" /> Export Plan
            </DropdownMenuItem>
            
            {onViewAnalytics && (
              <DropdownMenuItem onClick={onViewAnalytics}>
                <Eye className="mr-2 h-3.5 w-3.5" /> View Analytics
              </DropdownMenuItem>
            )}
            
            {onViewComments && (
              <DropdownMenuItem onClick={onViewComments}>
                <MessageSquare className="mr-2 h-3.5 w-3.5" /> View Comments
              </DropdownMenuItem>
            )}
            
            {!isHost && onReport && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onReport} className="text-orange-600">
                  <Flag className="mr-2 h-3.5 w-3.5" /> Report Plan
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
        
        {/* Delete Action - Always at the end */}
        {isHost && onDeleteRequest && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDeleteRequest(plan.id, plan.name);
              }}
              className="flex items-center text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Plan
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 