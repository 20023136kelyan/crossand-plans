'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MiniItineraryCard } from './MiniItineraryCard';
import type { ItineraryItem } from '@/types/plan';
import type { FieldArrayWithId } from 'react-hook-form';
import type { NewPlanFormValues } from './NewPlanForm';
import { motion } from 'framer-motion';

interface ReorderItineraryViewProps {
  items: FieldArrayWithId<NewPlanFormValues, "itinerary", "id">[];
  initialBounds: (DOMRect | null)[];
  onClose: () => void;
  onSwap: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}

function SortableCard({ item, index, onRemove, initialBounds }: { item: FieldArrayWithId<NewPlanFormValues, "itinerary", "id">, index: number, onRemove: (index: number) => void, initialBounds: DOMRect | null }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({id: item.id});

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const cardRef = useRef<HTMLDivElement>(null);
    const [finalBounds, setFinalBounds] = useState<DOMRect | null>(null);

    React.useLayoutEffect(() => {
        if(cardRef.current) {
            setFinalBounds(cardRef.current.getBoundingClientRect());
        }
    }, [])

    const initialX = initialBounds && finalBounds ? initialBounds.left - finalBounds.left : 0;
    const initialY = initialBounds && finalBounds ? initialBounds.top - finalBounds.top : 0;
    const initialScale = initialBounds && finalBounds ? initialBounds.width / finalBounds.width : 1;

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <motion.div
                ref={cardRef}
                initial={{ x: initialX, y: initialY, scale: initialScale, opacity: 0 }}
                animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                <MiniItineraryCard item={item} onRemove={() => onRemove(index)} isDragging={isDragging} />
            </motion.div>
        </div>
    )
}

export function ReorderItineraryView({ items, initialBounds, onClose, onSwap, onRemove }: ReorderItineraryViewProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event;
    
    if (over && active.id !== over.id) {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        onSwap(oldIndex, newIndex);
    }
  }

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex flex-col animate-fade-in">
      <header className="flex justify-end p-4">
        <Button onClick={onClose} variant="ghost" className="rounded-full h-12 w-32 text-lg">
          Done
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext 
                items={items.map(i => i.id)}
                strategy={rectSortingStrategy}
            >
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {items.map((item, index) => (
                        <SortableCard key={item.id} item={item} index={index} onRemove={onRemove} initialBounds={initialBounds[index]} />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
      </div>
    </div>
  );
} 