'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowPathIcon, ShareIcon } from '@heroicons/react/24/outline';
import type { Plan } from '@/types/user';

interface ShareToFeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan;
  onSubmit: (message: string) => Promise<void>;
}

export function ShareToFeedDialog({
  open,
  onOpenChange,
  plan,
  onSubmit,
}: ShareToFeedDialogProps) {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(message.trim());
      setMessage('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error sharing to feed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setMessage('');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShareIcon className="h-5 w-5" />
            Share to Feed
          </DialogTitle>
          <DialogDescription>
            Share "{plan.name}" with your followers and let them know about this amazing plan!
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Your message</Label>
            <Textarea
              id="message"
              placeholder="Tell your followers about this plan..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px] resize-none"
              maxLength={500}
              disabled={isSubmitting}
            />
            <div className="text-xs text-muted-foreground text-right">
              {message.length}/500 characters
            </div>
          </div>
          
          {/* Plan Preview */}
          <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
            <div className="text-sm font-medium text-foreground mb-1">
              {plan.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {plan.location} • {plan.eventType}
            </div>
            {plan.description && (
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {plan.description}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!message.trim() || isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                Sharing...
              </>
            ) : (
              <>
                <ShareIcon className="h-4 w-4 mr-2" />
                Share to Feed
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}