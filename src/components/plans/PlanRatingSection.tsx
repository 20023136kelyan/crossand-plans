'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, X, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface RatingInputProps {
  currentRating: number;
  onRatingChange: (rating: number) => void;
  disabled?: boolean;
  hasRated?: boolean;
}

const RatingInput = ({ currentRating, onRatingChange, disabled, hasRated }: RatingInputProps) => {
  const [hoverRating, setHoverRating] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleRatingClick = (rating: number) => {
    if (!disabled) {
      setIsAnimating(true);
      onRatingChange(rating);
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  const getRatingText = (rating: number) => {
    const texts = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
    return texts[rating] || '';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= (hoverRating || currentRating);
          const isActive = star <= currentRating;
          return (
            <button
              key={star}
              type="button"
              className={cn(
                "group relative p-2 rounded-full transition-all duration-200 ease-out",
                disabled ? "cursor-not-allowed" : "cursor-pointer hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-800",
                isAnimating && isActive && "animate-pulse"
              )}
              onClick={() => handleRatingClick(star)}
              onMouseEnter={() => !disabled && setHoverRating(star)}
              onMouseLeave={() => !disabled && setHoverRating(0)}
              disabled={disabled}
            >
              <Star
                className={cn(
                  "h-8 w-8 transition-all duration-200 ease-out",
                  isFilled
                    ? "fill-orange-400 text-orange-400 drop-shadow-sm"
                    : "text-gray-300 hover:text-orange-300 dark:text-gray-600 dark:hover:text-orange-400",
                  !disabled && "group-hover:scale-110"
                )}
              />
              {isFilled && !disabled && (
                <div className="absolute inset-0 rounded-full bg-orange-400/20 animate-ping" />
              )}
            </button>
          );
        })}
      </div>
      
      {(hoverRating > 0 || currentRating > 0) && (
        <div className="text-center">
          <p className={cn(
            "text-sm font-medium transition-all duration-200",
            hoverRating > 0 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
          )}>
            {getRatingText(hoverRating || currentRating)}
          </p>
        </div>
      )}
      
      {hasRated && (
        <div className="flex items-center justify-center gap-2 p-2 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border border-border/50">
          <Sparkles className="h-3 w-3 text-orange-500" />
          <span className="text-xs font-medium text-muted-foreground">
            You rated this plan {currentRating} star{currentRating !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
};

interface PlanRatingSectionProps {
  isHost: boolean;
  userRating: number;
  hasRated: boolean;
  ratingLoading: boolean;
  canRate?: boolean; // New prop to control if user can rate
  onRatingChange: (rating: number) => void;
  onRatingSubmit: () => void;
  onClearRating: () => void;
}

export function PlanRatingSection({
  isHost,
  userRating,
  hasRated,
  ratingLoading,
  canRate = true, // Default to true for backward compatibility
  onRatingChange,
  onRatingSubmit,
  onClearRating,
}: PlanRatingSectionProps) {
  if (isHost || !canRate) {
    return null;
  }

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-card to-card/80 border-border/50">
      <CardHeader className="bg-gradient-primary p-4">
        <CardTitle className="flex items-center gap-3 text-center justify-center text-primary-foreground">
          <Star className="h-5 w-5" />
          <span className="text-lg font-semibold">Rate This Plan</span>
        </CardTitle>
        <p className="text-sm text-primary-foreground/80 text-center mt-1">
          Share your experience to help others
        </p>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-4">
          <RatingInput
            currentRating={userRating}
            onRatingChange={onRatingChange}
            disabled={hasRated}
            hasRated={hasRated}
          />
          
          <div className="flex gap-2">
            {!hasRated ? (
              <Button
                onClick={onRatingSubmit}
                disabled={userRating === 0 || ratingLoading}
                size="lg"
                className={cn(
                  "flex-1 font-medium transition-all duration-200",
                  userRating > 0 && "bg-gradient-primary hover:bg-gradient-primary-hover"
                )}
              >
                {ratingLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Star className="h-4 w-4 mr-2" />
                    Submit Rating
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={onClearRating}
                disabled={ratingLoading}
                variant="outline"
                size="lg"
                className="flex-1 font-medium hover:bg-red-50 hover:border-red-200 hover:text-red-700 dark:hover:bg-red-950/20 dark:hover:border-red-800 dark:hover:text-red-400"
              >
                {ratingLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Change Rating
                  </>
                )}
              </Button>
            )}
          </div>
          
          {hasRated && (
            <div className="text-center p-3 bg-gradient-to-r from-muted/30 to-muted/20 rounded-lg border border-border/50">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="p-1 bg-gradient-primary rounded-full">
                  <Sparkles className="h-3 w-3 text-primary-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Thank you for your feedback!
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your rating helps improve the community experience
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}