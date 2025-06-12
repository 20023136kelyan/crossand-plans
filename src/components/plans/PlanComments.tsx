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
import { MessageSquare, MoreHorizontal, Edit, Trash2, Loader2, Send, Heart, Reply, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Comment {
  id: string;
  text: string;
  userId: string;
  userName: string | null;
  userAvatarUrl?: string | null;
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
      <Card className="overflow-hidden bg-gradient-to-br from-muted/20 to-muted/30 border-muted/40">
        <CardHeader className="bg-gradient-to-br from-muted/10 to-muted/20 border-b border-muted/20 py-2">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                 <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-xs">Discussion</h3>
                <p className="text-xs text-muted-foreground">
                  {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                </p>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="space-y-3">
            {/* Add Comment - Only show if user can comment */}
            {currentUserId && canComment && (
              <div className="space-y-2">
                <div className="relative max-w-md mx-auto">
                  <Textarea
                    placeholder="Share your thoughts..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={1}
                    className="resize-none pr-12 text-xs min-h-[32px]"
                  />
                  <Button
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || newComment.length > 500 || commentLoading}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "absolute bottom-1 right-1 h-5 w-5 p-0 font-medium transition-all duration-300 rounded-full border-2",
                      newComment.trim() 
                        ? "border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white hover:shadow-lg hover:shadow-orange-500/25 hover:scale-105" 
                        : "border-muted/40 text-muted-foreground"
                    )}
                  >
                    {commentLoading ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <Send className="h-2.5 w-2.5" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Be respectful and constructive
                </p>
              </div>
            )}

            {/* Comments List */}
            <div className="space-y-3">
              {comments.length === 0 ? (
                <div className="text-center py-3">
                  <div className="mx-auto w-8 h-8 bg-gradient-to-br from-muted/20 to-muted/30 rounded-full flex items-center justify-center mb-1">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-foreground mb-1 text-xs">
                    No comments yet
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Be the first to share your thoughts!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment, index) => (
                    <div key={comment.id} className={cn(
                      "group relative",
                      index > 0 && "border-t border-muted/30 pt-4"
                    )}>
                      <div className="flex gap-3">
                        <Avatar className="h-8 w-8 flex-shrink-0 ring-1 ring-muted/30">
                          <AvatarImage src={comment.userAvatarUrl || undefined} />
                          <AvatarFallback className="bg-gradient-primary text-primary-foreground font-medium text-xs">
                            {comment.userName?.charAt(0)?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-foreground">
                                {comment.userName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(comment.createdAt), {
                                  addSuffix: true,
                                })}
                              </span>
                              {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                                <span className="text-xs bg-gradient-to-r from-primary/20 to-primary/30 text-primary px-1.5 py-0.5 rounded-full">
                                  edited
                                </span>
                              )}
                            </div>
                            {currentUserId === comment.userId && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem
                                    onClick={() => handleEditCommentRequest(comment.id, comment.text)}
                                    className="cursor-pointer"
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteCommentRequest(comment.id)}
                                    className="text-destructive cursor-pointer"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                          
                          {editingCommentId === comment.id ? (
                            <div className="space-y-2">
                              <div className="relative">
                                <Textarea
                                 value={editCommentText}
                                 onChange={(e) => setEditCommentText(e.target.value)}
                                 rows={2}
                                 className="resize-none bg-gradient-to-br from-muted/20 to-muted/40 border-muted/50 focus:border-primary/50 text-sm"
                               />
                                <div className="absolute bottom-1.5 right-2 text-xs text-muted-foreground">
                                  {editCommentText.length}/500
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={handleConfirmEditComment}
                                  disabled={!editCommentText.trim() || editCommentText.length > 500}
                                  className="bg-gradient-primary hover:opacity-90 h-7 text-xs"
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Save
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={handleCancelEditComment}
                                  className="h-7 text-xs"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="bg-gradient-to-br from-muted/20 to-muted/40 rounded-lg p-3 border border-muted/30">
                                <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                                  {comment.text}
                                </p>
                              </div>
                              
                              {/* Comment Actions */}
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <button className="flex items-center gap-1 hover:text-red-500 transition-colors">
                                   <Heart className="h-3 w-3" />
                                   Like
                                 </button>
                                 <button className="flex items-center gap-1 hover:text-primary transition-colors">
                                   <Reply className="h-3 w-3" />
                                   Reply
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
      </Card>

      {/* Delete Comment Dialog */}
      <Dialog open={!!deletingCommentId} onOpenChange={handleCancelDeleteComment}>
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-muted/30 to-muted/50 border-muted/50">
          <DialogHeader>
            <div className="mx-auto w-10 h-10 bg-gradient-to-br from-destructive/20 to-destructive/30 rounded-full flex items-center justify-center mb-3">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle className="text-center text-sm">Delete Comment</DialogTitle>
            <DialogDescription className="text-center text-xs">
              Are you sure you want to delete this comment? This action cannot be undone and will permanently remove your comment from the discussion.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={handleCancelDeleteComment}
              className="flex-1 h-8 text-xs"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDeleteComment}
              className="flex-1 h-8 text-xs bg-gradient-to-r from-destructive to-destructive/80 hover:opacity-90"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}