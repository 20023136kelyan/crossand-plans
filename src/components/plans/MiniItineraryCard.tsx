'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ItineraryImageLoader } from './ItineraryImageLoader';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import type { FieldArrayWithId } from 'react-hook-form';
import type { NewPlanFormValues } from './NewPlanForm';

interface MiniItineraryCardProps {
  item: FieldArrayWithId<NewPlanFormValues, "itinerary", "id">;
  onRemove: () => void;
  isDragging?: boolean;
}

export function MiniItineraryCard({ item, onRemove, isDragging }: MiniItineraryCardProps) {
  return (
    <div className={cn(
        "relative aspect-[3/4] rounded-lg overflow-hidden shadow-md transition-transform",
        isDragging && "scale-105 shadow-2xl z-10"
    )}>
      <ItineraryImageLoader item={item} altText={item.placeName ?? "Itinerary stop"} />

      {/* Gradient overlay for text */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      {/* Place Name */}
      <p className="absolute bottom-2 left-2 right-2 text-white font-bold text-sm truncate">
        {item.placeName || 'Unnamed Stop'}
      </p>

      {/* Delete Button */}
      <Button
        type="button"
        onClick={onRemove}
        variant="destructive"
        className="absolute top-1 right-1 h-6 w-6 rounded-full p-0 bg-black/50 hover:bg-red-500/80"
      >
        <XMarkIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}