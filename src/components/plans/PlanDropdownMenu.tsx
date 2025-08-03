'use client';

import { Plan } from '@/types/plan';
import { parseISO, isValid, isPast } from 'date-fns';
import {
  EllipsisHorizontalIcon,
  EyeIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  TrashIcon,
  ShareIcon,
  QrCodeIcon,
  LinkIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  ArrowDownTrayIcon,
  FlagIcon,
  BookmarkIcon,
  Cog6ToothIcon,
  UserPlusIcon
} from '@heroicons/react/24/outline';
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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  variant = 'basic',
  open,
  onOpenChange
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
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={`rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 text-white border border-white/20 transition-all duration-200 ${triggerClassName}`}
          style={{ width: 40, height: 40, minWidth: 40, minHeight: 40 }}
          disabled={isLoading}
        >
          <EllipsisHorizontalIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={className}>
        {/* Basic Actions - Always Available */}
        <DropdownMenuItem asChild>
          <Link href={`/p/${plan.id}`} className="flex items-center text-xs cursor-pointer">
            <EyeIcon className="h-4 w-4 mr-2" /> View Details
          </Link>
        </DropdownMenuItem>
        
        {/* Host Actions */}
        {isHost && (
          <>
            <DropdownMenuItem asChild>
              <Link href={`/plans/create?editId=${plan.id}`} className="flex items-center text-xs cursor-pointer">
                <PencilSquareIcon className="h-4 w-4 mr-2" /> Edit Plan
              </Link>
            </DropdownMenuItem>
            
            {canManage && onManageParticipants && (
              <DropdownMenuItem onClick={onManageParticipants}>
                <UserPlusIcon className="h-4 w-4 mr-2" /> Manage Participants
              </DropdownMenuItem>
            )}
            
            {variant === 'enhanced' && (
              <DropdownMenuItem>
                <Cog6ToothIcon className="h-4 w-4 mr-2" /> Plan Settings
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
              <CheckCircleIcon className="h-4 w-4 mr-2" /> Mark as Completed
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
              <CheckCircleIcon className="h-4 w-4 mr-2" /> Confirm Completion
            </DropdownMenuItem>
          </>
        )}
        
        {/* Share Actions */}
        {(onShare || onCopyLink || onQRCode || onShareWithFriends || onShareToFeed) && (
          <>
            <DropdownMenuSeparator />
            {onShare && (
              <DropdownMenuItem onClick={onShare}>
                <ShareIcon className="h-4 w-4 mr-2" /> Share
              </DropdownMenuItem>
            )}
            {onCopyLink && (
              <DropdownMenuItem onClick={onCopyLink}>
                <LinkIcon className="h-4 w-4 mr-2" /> Copy Link
              </DropdownMenuItem>
            )}
            {onQRCode && (
              <DropdownMenuItem onClick={onQRCode}>
                <QrCodeIcon className="h-4 w-4 mr-2" /> QR Code
              </DropdownMenuItem>
            )}
            {onShareWithFriends && (
              <DropdownMenuItem onClick={onShareWithFriends}>
                <UserGroupIcon className="h-4 w-4 mr-2" /> Share with Friends
              </DropdownMenuItem>
            )}
            {onShareToFeed && (
              <DropdownMenuItem onClick={onShareToFeed}>
                <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2" /> Share to Feed
              </DropdownMenuItem>
            )}
          </>
        )}
        
        {/* Copy Plan Action */}
        {canCopy && onCopyPlan && (
          <DropdownMenuItem onClick={onCopyPlan}>
            <BookmarkIcon className="h-4 w-4 mr-2" /> Copy Plan
          </DropdownMenuItem>
        )}
        
        {/* Enhanced Actions */}
        {variant === 'enhanced' && (
          <>
            {!isHost && onSaveToCollection && (
              <DropdownMenuItem onClick={onSaveToCollection}>
                <BookmarkIcon className="h-4 w-4 mr-2" />
                {isSaved ? 'Remove from Collection' : 'Save to Collection'}
              </DropdownMenuItem>
            )}
            
            <DropdownMenuItem>
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" /> Export Plan
            </DropdownMenuItem>
            
            {onViewAnalytics && (
              <DropdownMenuItem onClick={onViewAnalytics}>
                <EyeIcon className="h-4 w-4 mr-2" /> View Analytics
              </DropdownMenuItem>
            )}
            
            {onViewComments && (
              <DropdownMenuItem onClick={onViewComments}>
                <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2" /> View Comments
              </DropdownMenuItem>
            )}
            
            {!isHost && onReport && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onReport} className="text-orange-600">
                  <FlagIcon className="h-4 w-4 mr-2" /> Report Plan
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
              <TrashIcon className="h-4 w-4 mr-2" /> Delete Plan
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 