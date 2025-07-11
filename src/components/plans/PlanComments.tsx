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
import { MessageSquare, MoreHorizontal, Edit, Trash2, Loader2, Send, Heart, Reply, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { VerificationBadge } from '@/components/ui/verification-badge';
import type { UserRoleType } from '@/types/user';

interface Comment {
  id: string;
  text: string;
  userId: string;
  userName: string | null;
  username?: string | null;
  userAvatarUrl?: string | null;
  role?: UserRoleType | null;
  isVerified?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface PlanCommentsProps {
  comments: Comment[];
  currentUserId?: string;
  canComment?: boolean; // New prop to control if user can comment
  onCommentSubmit: (content: string) => Promise<void>;
  onCommentUpdate: (commentId: string, content: string) => Promise<void>;
  onCommentDelete: (commentId: string) => Promise<void>;
}

export default function PlanComments({
  comments,
  currentUserId,
  canComment = true, // Default to true for backward compatibility
  onCommentSubmit,
  onCommentUpdate,
  onCommentDelete,
}: PlanCommentsProps) {
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    
    setCommentLoading(true);
    try {
      await onCommentSubmit(newComment);
      setNewComment('');
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleEditCommentRequest = (commentId: string, currentText: string) => {
    setEditingCommentId(commentId);
    setEditCommentText(currentText);
  };

  const handleConfirmEditComment = async () => {
    if (!editingCommentId || !editCommentText.trim()) return;
    
    try {
      await onCommentUpdate(editingCommentId, editCommentText);
      setEditingCommentId(null);
      setEditCommentText('');
    } catch (error) {
      console.error('Error updating comment:', error);
    }
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditCommentText('');
  };

  const handleDeleteCommentRequest = (commentId: string) => {
    setDeletingCommentId(commentId);
  };

  const handleConfirmDeleteComment = async () => {
    if (!deletingCommentId) return;
    
    try {
      await onCommentDelete(deletingCommentId);
      setDeletingCommentId(null);
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleCancelDeleteComment = () => {
    setDeletingCommentId(null);
  };
  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-br from-background via-muted/5 to-muted/10 border border-border/50 shadow-lg backdrop-blur-sm">
        {/* Collapsible Header */}
        <CardHeader
          className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-b border-border/30 py-3 cursor-pointer select-none flex flex-row items-center justify-between"
          onClick={() => setExpanded((prev) => !prev)}
        >
          <div className="flex items-center gap-3">
            <div className="relative p-2 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/20">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm tracking-tight">Discussion</h3>
              <p className="text-sm text-muted-foreground font-medium">
                {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" tabIndex={-1} className="ml-auto" onClick={e => { e.stopPropagation(); setExpanded((prev) => !prev); }}>
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </Button>
        </CardHeader>
        {/* Collapsible Content */}
        {expanded && (
          <CardContent className="p-6 animate-fade-in">
            <div className="space-y-6">
              {/* Add Comment - Only show if user can comment */}
              {currentUserId && canComment && (
                <div className="space-y-4">
                  <div className="relative">
                    <Textarea
                      placeholder="Share your thoughts and join the conversation..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                      className="resize-none pr-16 text-sm min-h-[80px] bg-gradient-to-br from-muted/20 to-muted/10 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 rounded-xl transition-all duration-200"
                    />
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                      <span className={cn(
                        "text-xs font-medium transition-colors",
                        newComment.length > 450 ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {newComment.length}/500
                      </span>
                      <Button
                        onClick={handleSubmitComment}
                        disabled={!newComment.trim() || newComment.length > 500 || commentLoading}
                        size="sm"
                        className={cn(
                          "h-8 px-4 font-medium transition-all duration-300 rounded-lg",
                          newComment.trim() && newComment.length <= 500
                            ? "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-primary/25 hover:scale-105" 
                            : "bg-muted/50 text-muted-foreground cursor-not-allowed"
                        )}
                      >
                        {commentLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Posting...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Post Comment
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                    <span>Be respectful and constructive in your discussion</span>
                  </div>
                </div>
              )}

              {/* Comments List */}
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-muted/30 to-muted/20 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-border/30">
                      <MessageSquare className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2 text-lg">
                      No comments yet
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                      Start the conversation! Share your thoughts and engage with others.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {comments.map((comment, index) => (
                      <div key={comment.id} className={cn(
                        "group relative p-4 rounded-2xl bg-gradient-to-br from-muted/10 to-muted/5 border border-border/30 hover:border-border/50 transition-all duration-300 hover:shadow-lg hover:shadow-muted/20",
                        index > 0 && "mt-4"
                      )}>
                        <div className="flex gap-4">
                          <Avatar className="h-12 w-12 flex-shrink-0 ring-2 ring-border/30 hover:ring-primary/30 transition-all duration-200">
                            <AvatarImage src={comment.userAvatarUrl || undefined} className="object-cover" />
                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-sm">
                              {comment.userName?.charAt(0)?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                  <span className="font-semibold text-sm text-foreground">
                                    {comment.userName}
                                  </span>
                                  <VerificationBadge role={comment.role} isVerified={comment.isVerified} />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground font-medium">
                                    {formatDistanceToNow(new Date(comment.createdAt), {
                                      addSuffix: true,
                                    })}
                                  </span>
                                  {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                                    <span className="text-xs bg-gradient-to-r from-primary/20 to-primary/10 text-primary px-2 py-1 rounded-full font-medium ring-1 ring-primary/20">
                                      edited
                                    </span>
                                  )}
                                </div>
                              </div>
                              {currentUserId === comment.userId && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-muted/50 rounded-lg"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44 bg-background/95 backdrop-blur-sm border-border/50 shadow-xl">
                                    <DropdownMenuItem
                                      onClick={() => handleEditCommentRequest(comment.id, comment.text)}
                                      className="cursor-pointer hover:bg-muted/50 transition-colors duration-200 rounded-md"
                                    >
                                      <Edit className="h-4 w-4 mr-3" />
                                      Edit Comment
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteCommentRequest(comment.id)}
                                      className="text-destructive cursor-pointer hover:bg-destructive/10 transition-colors duration-200 rounded-md"
                                    >
                                      <Trash2 className="h-4 w-4 mr-3" />
                                      Delete Comment
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                            
                            {editingCommentId === comment.id ? (
                              <div className="space-y-4">
                                <div className="relative">
                                  <Textarea
                                   value={editCommentText}
                                   onChange={(e) => setEditCommentText(e.target.value)}
                                   rows={3}
                                   className="resize-none bg-gradient-to-br from-background to-muted/10 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 text-sm rounded-xl transition-all duration-200"
                                 />
                                  <div className="absolute bottom-3 right-3 text-xs font-medium text-muted-foreground">
                                    {editCommentText.length}/500
                                  </div>
                                </div>
                                <div className="flex gap-3">
                                  <Button 
                                    size="sm" 
                                    onClick={handleConfirmEditComment}
                                    disabled={!editCommentText.trim() || editCommentText.length > 500}
                                    className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 h-9 px-4 text-sm font-medium shadow-lg hover:shadow-primary/25 transition-all duration-200"
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Save Changes
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={handleCancelEditComment}
                                    className="h-9 px-4 text-sm font-medium hover:bg-muted/50 transition-colors duration-200"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="bg-gradient-to-br from-background/80 to-muted/20 rounded-xl p-4 border border-border/30 shadow-sm">
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                                    {comment.text}
                                  </p>
                                </div>
                                
                                {/* Comment Actions */}
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <button className="flex items-center gap-2 hover:text-red-500 transition-all duration-200 hover:scale-105 px-2 py-1 rounded-lg hover:bg-red-50/50">
                                     <Heart className="h-4 w-4" />
                                     <span className="font-medium">Like</span>
                                   </button>
                                   <button className="flex items-center gap-2 hover:text-primary transition-all duration-200 hover:scale-105 px-2 py-1 rounded-lg hover:bg-primary/5">
                                     <Reply className="h-4 w-4" />
                                     <span className="font-medium">Reply</span>
                                   </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Delete Comment Dialog */}
      <Dialog open={!!deletingCommentId} onOpenChange={handleCancelDeleteComment}>
        <DialogContent className="sm:max-w-lg bg-gradient-to-br from-background/95 to-muted/20 border-border/50 shadow-2xl backdrop-blur-sm">
          <DialogHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-destructive/20 to-destructive/10 rounded-2xl flex items-center justify-center ring-1 ring-destructive/20">
              <Trash2 className="h-8 w-8 text-destructive" />
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
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}