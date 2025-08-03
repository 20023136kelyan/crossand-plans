'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChatBubbleLeftRightIcon, EllipsisHorizontalIcon, PencilIcon, TrashIcon, ArrowPathIcon, PaperAirplaneIcon, HeartIcon, ArrowUturnLeftIcon, ChatBubbleLeftEllipsisIcon, ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect, useCallback } from 'react';
import { db, serverTimestamp } from '@/lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp
} from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { createListenerWithRetry, getCollectionFallback } from '@/lib/firebaseListenerUtils';
import { VerificationBadge } from '@/components/ui/verification-badge';
import type { UserRoleType } from '@/types/user';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';

// Helper function to safely convert Firestore timestamps to dates
const convertTimestampToDate = (timestamp: string | Timestamp): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  return new Date(timestamp);
};

interface Comment {
  id: string;
  text: string;
  userId: string;
  userName: string | null;
  username?: string | null;
  userAvatarUrl?: string | null;
  role?: UserRoleType | null;
  isVerified?: boolean;
  createdAt: string | Timestamp;
  updatedAt?: string | Timestamp;
}

interface PlanCommentsProps {
  planId: string;
  currentUserId?: string;
  canComment?: boolean;
}

export default function PlanComments({
  planId,
  currentUserId,
  canComment = true,
}: PlanCommentsProps) {
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { currentUserProfile } = useAuth();

  // Fetch comments in real-time
  useEffect(() => {
    if (!planId) return;
    setLoading(true);
    
    const q = query(
      collection(db!, 'plans', planId, 'comments'),
      orderBy('createdAt', 'asc')
    );
    
    const listener = createListenerWithRetry(
      () => onSnapshot(q, (snapshot) => {
      const fetchedComments = snapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Comment));
      // Debug logging to understand comment data structure
      // Uncomment for debugging:
      /*
      fetchedComments.forEach(comment => {
        console.log({
          id: comment.id,
          text: comment.text,
          createdAt: comment.createdAt,
          createdAtType: typeof comment.createdAt,
          isTimestamp: comment.createdAt instanceof Timestamp
        });
      });
      */
      setComments(fetchedComments);
      setLoading(false);
      }),
      (comments) => {
        setComments(comments);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to comments:', error);
        setLoading(false);
      },
      () => getCollectionFallback<Comment>(`plans/${planId}/comments`, [orderBy('createdAt', 'asc')])
    );
    
    return () => listener.unsubscribe();
  }, [planId]);

  // Add comment
  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim() || !currentUserId) return;
    setCommentLoading(true);
    try {
      // Debug: log currentUserProfile
      
      await addDoc(collection(db!, 'plans', planId, 'comments'), {
        userId: currentUserId,
        userName: currentUserProfile?.name || null,
        username: currentUserProfile?.username || null,
        userAvatarUrl: currentUserProfile?.avatarUrl || null,
        role: currentUserProfile?.role || null,
        isVerified: currentUserProfile?.isVerified || false,
        text: newComment.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewComment('');
    } catch (error: any) {
      console.error('Error submitting comment:', error);
      
      // More specific error handling
      if (error.code === 'permission-denied') {
        console.error('Permission denied. Possible reasons:');
        console.error('- User not authenticated');
        console.error('- User not a plan participant (host or invited)');
        console.error('- Comment text is empty');
        console.error('- Invalid data format');
      }
      
      // Show user-friendly error message
      toast({
        title: "Comment failed",
        description: "Unable to post comment. Please check if you're a participant of this plan.",
        variant: "destructive"
      });
    } finally {
      setCommentLoading(false);
    }
  }, [newComment, currentUserId, planId, currentUserProfile]);

  // Edit comment
  const handleEditCommentRequest = (commentId: string, currentText: string) => {
    setEditingCommentId(commentId);
    setEditCommentText(currentText);
  };

  const handleConfirmEditComment = useCallback(async () => {
    if (!editingCommentId || !editCommentText.trim()) return;
    try {
      await updateDoc(
        doc(db!, 'plans', planId, 'comments', editingCommentId),
        {
          text: editCommentText.trim(),
          updatedAt: serverTimestamp(),
        }
      );
      setEditingCommentId(null);
      setEditCommentText('');
    } catch (error) {
      console.error('Error updating comment:', error);
    }
  }, [editingCommentId, editCommentText, planId]);

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditCommentText('');
  };

  // Delete comment
  const handleDeleteCommentRequest = (commentId: string) => {
    setDeletingCommentId(commentId);
  };

  const handleConfirmDeleteComment = useCallback(async () => {
    if (!deletingCommentId) return;
    try {
      await deleteDoc(doc(db!, 'plans', planId, 'comments', deletingCommentId));
      setDeletingCommentId(null);
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  }, [deletingCommentId, planId]);

  const handleCancelDeleteComment = () => {
    setDeletingCommentId(null);
  };

  return (
    <>
      {/* Floating Comment Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => setIsModalOpen(true)}
          variant="outline"
          size="icon"
          className="relative w-12 h-12 rounded-full bg-gradient-to-br from-background via-muted/5 to-muted/10 border border-border/50 shadow-lg backdrop-blur-sm hover:shadow-xl transition-all duration-200 hover:scale-110"
        >
          <ChatBubbleLeftEllipsisIcon className="h-6 w-6" />
          {comments.length > 0 && (
            <Badge 
              variant="default" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs font-bold bg-red-500 text-white"
            >
              {comments.length > 99 ? '99+' : comments.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Fullscreen Comments Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-none w-full h-full max-h-none p-0 bg-background" hideCloseButton>
          <DialogTitle className="sr-only">Comments</DialogTitle>
          <div className="flex flex-col h-full relative">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/30 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
              <div className="flex items-center gap-3">
                <div className="relative p-2 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/20">
                  <ChatBubbleLeftEllipsisIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg tracking-tight">Discussion</h3>
                  <p className="text-sm text-muted-foreground font-medium">
                    {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 text-white border border-white/20 transition-all duration-200"
              >
                <XMarkIcon className="h-5 w-5" />
              </Button>
            </div>

            {/* Comments List (scrollable, with bottom padding for input) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 pb-28">
              {/* Comments List */}
              <div className="space-y-0">
                {loading ? (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <ArrowPathIcon className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground mt-4">Loading comments...</p>
                  </div>
                ) : comments.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto w-16 h-16 bg-gradient-to-br from-muted/30 to-muted/20 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-border/30">
                        <ChatBubbleLeftRightIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold text-foreground mb-2 text-lg">
                        No comments yet
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                        Start the conversation! Share your thoughts and engage with others.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {comments.map((comment, index) => (
                      <div
                        key={comment.id}
                        className={cn(
                          "group relative rounded-lg shadow-sm border border-border/10 px-3 py-2 mb-2 flex gap-3 bg-transparent",
                          index === 0 ? "mt-0" : "mt-1"
                        )}
                      >
                        <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
                          <AvatarImage src={comment.userAvatarUrl || undefined} className="object-cover" />
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-xs">
                            {comment.username?.charAt(0)?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-sm text-foreground">
                                @{comment.username || 'user'}
                              </span>
                              {comment.role || comment.isVerified ? (
                                <VerificationBadge role={comment.role} isVerified={comment.isVerified} />
                              ) : null}
                            </div>
                            <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                              {formatDistanceToNow(convertTimestampToDate(comment.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <div className="mt-0.5">
                            <p className="text-sm leading-relaxed text-foreground break-words">{comment.text}</p>
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                            <button className="flex items-center gap-1 hover:text-primary transition-colors">
                              <HeartIcon className="h-3 w-3" />
                              <span className="font-medium">Like</span>
                            </button>
                            <button className="flex items-center gap-1 hover:text-primary transition-colors">
                              <ArrowUturnLeftIcon className="h-3 w-3" />
                              <span className="font-medium">Reply</span>
                            </button>
                            {/* Add more actions if needed */}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Add Comment - Only show if user can comment (fixed at bottom) */}
            {currentUserId && canComment && (
              <div className="fixed left-0 right-0 bottom-0 z-20 px-4 pb-8 pt-2" style={{maxWidth:'100vw'}}>
                <div className="rounded-2xl bg-black/60 dark:bg-black/80 backdrop-blur-md border border-white/20 shadow-sm px-3 py-2 flex items-end gap-2">
                  <Textarea
                    placeholder="Share your thoughts..."
                    value={newComment}
                    onChange={e => {
                      setNewComment(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    rows={1}
                    className="flex-1 resize-none border-none outline-none bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 rounded-xl transition-all duration-200 min-h-[40px]"
                    style={{ boxShadow: 'none', overflow: 'hidden' }}
                  />
                  <Button
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || newComment.length > 500 || commentLoading}
                    size="icon"
                    className={cn(
                      "rounded-full bg-primary/90 hover:bg-primary shadow-lg transition-all duration-200 w-10 h-10 flex items-center justify-center",
                      (!newComment.trim() || newComment.length > 500 || commentLoading) && "bg-muted/50 text-muted-foreground cursor-not-allowed shadow-none"
                    )}
                    style={{ boxShadow: '0 2px 12px 0 rgba(0,0,0,0.10)' }}
                    tabIndex={0}
                    aria-label="Post Comment"
                  >
                    {commentLoading ? (
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    ) : (
                      <PaperAirplaneIcon className="h-5 w-5 text-white" style={{ opacity: 1 }} />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Comment Dialog */}
      <Dialog open={!!deletingCommentId} onOpenChange={handleCancelDeleteComment}>
        <DialogContent className="sm:max-w-lg bg-gradient-to-br from-background/95 to-muted/20 border-border/50 shadow-2xl backdrop-blur-sm">
          <DialogHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-destructive/20 to-destructive/10 rounded-2xl flex items-center justify-center ring-1 ring-destructive/20">
              <TrashIcon className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-xl font-semibold">Delete Comment</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed max-w-sm mx-auto">
                Are you sure you want to delete this comment? This action cannot be undone and will permanently remove your comment from the discussion.
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter className="flex gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={handleCancelDeleteComment}
              className="flex-1 h-10 text-sm font-medium hover:bg-muted/50 transition-colors duration-200"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDeleteComment}
              className="flex-1 h-10 text-sm font-medium bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70 shadow-lg hover:shadow-destructive/25 transition-all duration-200"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete Comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}