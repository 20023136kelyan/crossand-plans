'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import TextareaAutosize from 'react-textarea-autosize';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Globe, PlusCircle, Ticket, UserCheck, Users, Edit2, ChevronDown, ChevronLeft, ChevronRight, Trash2, ArrowUpDown, CalendarIcon, Clock, MapPin as MapPinIcon, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import React, { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { createPlanAction } from '@/app/actions/planActions';
import { addHours, addMinutes, format } from 'date-fns';
import { ItineraryItem } from './ItineraryItem';
import { useGoogleMaps } from '@/context/GoogleMapsContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

import { cn } from '@/lib/utils';
import { ReorderItineraryView } from './ReorderItineraryView';
import type { FieldArrayWithId } from 'react-hook-form';

import { FriendMultiSelectInput } from './FriendMultiSelectInput';

const transitModeValues = ['driving', 'walking', 'bicycling', 'transit'] as const;

const itineraryItemSchema = z.object({
    id: z.string().uuid(),
    placeName: z.string().min(1, { message: "Location name is required." }),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    googlePlaceId: z.string().optional().nullable(),
    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable(),
    startTime: z.date().optional().nullable(),
    endTime: z.date().optional().nullable(),
    description: z.string().optional().nullable(),
    googlePhotoReference: z.string().optional().nullable(),
    googleMapsImageUrl: z.string().url().optional().nullable(),
    rating: z.number().min(0).max(5).optional().nullable(),
    reviewCount: z.number().int().min(0).optional().nullable(),
    activitySuggestions: z.array(z.string().max(100, "Suggestion is too long.")).max(3, "You can add up to 3 suggestions.").optional().nullable().default([]),
    isOperational: z.boolean().optional().nullable(),
    statusText: z.string().optional().nullable(),
    openingHours: z.array(z.string()).optional().nullable().default([]),
    phoneNumber: z.string().optional().nullable(),
    website: z.string().url().optional().nullable(),
    priceLevel: z.number().int().min(0).max(4).optional().nullable(),
    types: z.array(z.string()).optional().nullable().default([]),
    notes: z.string().optional().nullable(),
    durationMinutes: z.number().int().min(0).optional().nullable().default(60),
    transitMode: z.enum(transitModeValues).optional().nullable().default('driving'),
    transitTimeFromPreviousMinutes: z.number().int().min(0).optional().nullable(),
    placeDetails: z.any().optional(),
});

const newPlanFormSchema = z.object({
    name: z.string().min(1, { message: 'Plan name is required.' }),
    description: z.string().optional().nullable(),
    eventDateTime: z.date().optional().nullable(),
    primaryLocation: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    eventType: z.string().optional().nullable(),
    status: z.enum(['published', 'draft']),
    itinerary: z.array(itineraryItemSchema).min(1, 'A plan must have at least one location.'),
    invitedParticipantUserIds: z.array(z.string()).optional().default([]),
    photoHighlights: z.array(z.string().url()).optional().default([]),
    priceRange: z.enum(['Free', '$', '$$', '$$$', '$$$$']).optional().nullable(),
}).refine((data) => {
    if (data.status === 'published') {
        // For published plans, require more complete information
        // Check if we have a complete first itinerary item since we auto-fill from it
        const firstItineraryItem = data.itinerary[0];
        return firstItineraryItem && firstItineraryItem.placeName && firstItineraryItem.startTime && firstItineraryItem.city;
    }
    return true; // Drafts can be incomplete
}, {
    message: "Published plans require at least one complete itinerary item with location, time, and city.",
    path: ["itinerary"]
});

export type NewPlanFormValues = z.infer<typeof newPlanFormSchema>;

export function NewPlanForm() {
    const { toast } = useToast();
    const router = useRouter();
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { isLoaded: isGoogleMapsApiLoaded } = useGoogleMaps();
    const [visibleStopIndex, setVisibleStopIndex] = useState(0);
    const [animationDirection, setAnimationDirection] = useState<'left' | 'right' | 'none'>('none');
    const [isReorderModeActive, setIsReorderModeActive] = useState(false);
    const [isFriendSearchOpen, setIsFriendSearchOpen] = useState(false);
    const [isAccordionOpen, setIsAccordionOpen] = useState(false);
    const [initialCardBounds, setInitialCardBounds] = useState<(DOMRect | null)[]>([]);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const form = useForm<NewPlanFormValues>({
        resolver: zodResolver(newPlanFormSchema),
        mode: 'onChange',
        defaultValues: {
            name: '',
            description: null,
            eventDateTime: null,
            primaryLocation: null,
            city: null,
            eventType: null,
            status: 'draft', // Start as draft to encourage users to complete the form
            itinerary: [],
            invitedParticipantUserIds: [],
            photoHighlights: [],
            priceRange: null,
        },
    });

    const { fields, append, remove, swap } = useFieldArray({
        control: form.control,
        name: "itinerary",
    });

    const itineraryStops = form.watch('itinerary');
    const planStatus = form.watch('status');

    // Auto-populate primary location and city from first itinerary item
    React.useEffect(() => {
        const firstStop = itineraryStops[0];
        if (firstStop && firstStop.placeName && !form.getValues('primaryLocation')) {
            form.setValue('primaryLocation', firstStop.placeName);
        }
        if (firstStop && firstStop.city && !form.getValues('city')) {
            form.setValue('city', firstStop.city);
        }
        if (firstStop && firstStop.startTime && !form.getValues('eventDateTime')) {
            form.setValue('eventDateTime', firstStop.startTime);
        }
        
        // Auto-calculate price range from itinerary items using voting classification
        if (itineraryStops.length > 0) {
            const priceLevels = itineraryStops
                .map(stop => stop.priceLevel)
                .filter(level => level !== null && level !== undefined);
            
            if (priceLevels.length > 0) {
                // Count occurrences of each price level
                const priceCounts = priceLevels.reduce((acc, level) => {
                    acc[level] = (acc[level] || 0) + 1;
                    return acc;
                }, {} as Record<number, number>);
                
                // Find the most common price level (dominant class)
                const dominantPriceLevel = Object.entries(priceCounts)
                    .reduce((a, b) => priceCounts[parseInt(a[0])] > priceCounts[parseInt(b[0])] ? a : b)[0];
                
                // Map price level to app's price range labels
                const priceRangeMap: Record<number, string> = {
                    0: 'Free',
                    1: '$',
                    2: '$$', 
                    3: '$$$',
                    4: '$$$$'
                };
                
                const calculatedPriceRange = priceRangeMap[parseInt(dominantPriceLevel)];
                if (calculatedPriceRange) {
                    form.setValue('priceRange', calculatedPriceRange as any);
                }
            }
        }
    }, [itineraryStops, form]);

    async function onSubmit(data: NewPlanFormValues) {
        if (!user) {
            toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
            return;
        }

        // Validate required fields for published plans
        if (data.status === 'published') {
            const firstItineraryItem = data.itinerary[0];
            if (!firstItineraryItem || !firstItineraryItem.placeName || !firstItineraryItem.startTime || !firstItineraryItem.city) {
                toast({ 
                    title: "Missing Information", 
                    description: "Published plans require a complete first itinerary item with location, time, and city. Save as draft to continue editing later.", 
                    variant: "destructive" 
                });
                return;
            }
        }

        setIsSubmitting(true);
        const idToken = await user.getIdToken();
        
        // Ensure we have a valid eventDateTime
        const eventDateTime = data.eventDateTime || data.itinerary[0]?.startTime || new Date();
        
        // Transform data to match server expectations
        const actionData = { 
            name: data.name,
            description: data.description || null,
            eventDateTime: eventDateTime,
            primaryLocation: data.primaryLocation || data.itinerary[0]?.placeName || '', 
            city: data.city || data.itinerary[0]?.city || '', 
            eventType: data.eventType || null,
            priceRange: data.priceRange || null,
            invitedParticipantUserIds: (data.invitedParticipantUserIds || []).filter(
                (uid) => uid !== user?.uid
            ),
            photoHighlights: data.photoHighlights || [],
            status: data.status,
            planType: data.itinerary.length > 1 ? 'multi-stop' : 'single-stop' as 'multi-stop' | 'single-stop', 
            itinerary: data.itinerary.map(stop => {
                const startTime = stop.startTime || new Date();
                const endTime = stop.endTime || addHours(startTime, 1);
                
                return {
                    ...stop, // Preserve all original fields from the form
                    id: stop.id,
                    placeName: stop.placeName || '',
                    address: stop.address ?? null,
                    city: stop.city ?? null,
                    startTime: startTime.toISOString(), 
                    endTime: endTime.toISOString(),
                    description: stop.description ?? null,
                    googlePlaceId: stop.googlePlaceId ?? null,
                    googleMapsImageUrl: stop.googleMapsImageUrl ?? null,
                    googlePhotoReference: stop.googlePhotoReference ?? null,
                    lat: stop.lat ?? null,
                    lng: stop.lng ?? null,
                    rating: stop.rating ?? null,                          // ✅ Fixed: Use ?? to preserve 0 values
                    reviewCount: stop.reviewCount ?? null,                // ✅ Fixed: Use ?? to preserve 0 values
                    activitySuggestions: stop.activitySuggestions ?? [],
                    isOperational: stop.isOperational ?? null,
                    statusText: stop.statusText ?? null,
                    openingHours: stop.openingHours ?? [],
                    phoneNumber: stop.phoneNumber ?? null,
                    website: stop.website ?? null,
                    priceLevel: stop.priceLevel ?? null,                  // ✅ Fixed: Use ?? to preserve 0 values (Free)
                    types: stop.types ?? [],
                    notes: stop.notes ?? null,
                    durationMinutes: stop.durationMinutes ?? 60,
                    transitMode: stop.transitMode ?? 'driving',
                    transitTimeFromPreviousMinutes: stop.transitTimeFromPreviousMinutes ?? null,
                };
            }), 
        };

        // 🔍 DETAILED CLIENT-SIDE LOGGING
        // (Removed unnecessary logging block that caused syntax error)
        const result = await createPlanAction(actionData, idToken);
        if (result.success && result.planId) {
            const statusText = data.status === 'published' ? 'published' : 'saved as draft';
            toast({ title: `Plan ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}!`, description: `Your plan "${data.name}" has been successfully ${statusText}.` });
            router.push(`/plans/${result.planId}`);
        } else {
            toast({ title: "Error", description: result.error || "Could not create plan.", variant: "destructive" });
        }
        setIsSubmitting(false);
    }

    const addNewStop = () => {
        const itinerary = form.getValues().itinerary;
        const lastStop = itinerary.length > 0 ? itinerary[itinerary.length - 1] : null;

        let newStartTime;

        if (lastStop && lastStop.endTime) {
            newStartTime = addMinutes(lastStop.endTime, 30);
        } else {
            newStartTime = new Date();
        }

        const newEndTime = addHours(newStartTime, 1);

        append({
            id: crypto.randomUUID(),
            placeName: '',
            address: null,
            city: null,
            googlePlaceId: null,
            lat: null,
            lng: null,
            startTime: newStartTime,
            endTime: newEndTime,
            description: null,
            googlePhotoReference: null,
            googleMapsImageUrl: null,
            rating: null,
            reviewCount: null,
            activitySuggestions: [],
            isOperational: null,
            statusText: null,
            openingHours: [],
            phoneNumber: null,
            website: null,
            priceLevel: null,
            types: [],
            notes: null,
            durationMinutes: 60,
            transitMode: 'driving',
            transitTimeFromPreviousMinutes: null,
        });
    };

    const handleEnterReorderMode = () => {
        const bounds = fields.map((_, index) => {
            const el = itemRefs.current[index];
            return el ? el.getBoundingClientRect() : null;
        });
        setInitialCardBounds(bounds);
        setIsReorderModeActive(true);
    };

    const isFormValid = () => {
        const values = form.getValues();
        const firstItineraryItem = values.itinerary[0];
        
        if (planStatus === 'published') {
            return values.name && firstItineraryItem && firstItineraryItem.placeName && firstItineraryItem.startTime && firstItineraryItem.city;
        }
        return values.name && values.itinerary.length > 0; // Drafts just need name and at least one stop
    };

    return (
        <div className="h-full flex flex-col text-foreground relative">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col relative">
                    {/* Fade to black overlay when UI elements expand */}
                    <div 
                        className={`absolute inset-0 pointer-events-none z-20 transition-opacity duration-300 ${
                            (isFriendSearchOpen || isDescriptionExpanded || isAccordionOpen) ? 'opacity-100' : 'opacity-0'
                        }`}
                        style={{
                            background: 'linear-gradient(to bottom, transparent 0%, transparent 50%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0.6) 85%, rgba(0,0,0,0.9) 100%)'
                        }}
                    />
                    <div className="px-4 pt-3 sm:px-6 sm:pt-4 space-y-4 max-w-3xl mx-auto w-full">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem className="space-y-0">
                                <FormControl>
                                    <Input
                                        placeholder="Plan Name"
                                        {...field}
                                        maxLength={70}
                                        className="text-2xl font-bold !border-0 !ring-0 !shadow-none !bg-transparent focus:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus:!ring-0 focus:!ring-offset-0 p-0 placeholder:text-muted-foreground rounded-none"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => {
                                const description = field.value || '';
                                const hasContent = Boolean(description.trim());
                                
                                // Calculate if text needs truncation based on character count for simplicity
                                const needsTruncation = description.length > 120;
                                
                                // Get truncated text for display - limit to ~120 chars to ensure it fits in 2 lines
                                const getTruncatedText = () => {
                                    if (description.length > 120) {
                                        return description.substring(0, 100).trim();
                                    }
                                    return description;
                                };
                                
                                const truncatedText = getTruncatedText();
                                
                                return (
                                    <FormItem className="space-y-0">
                                        <FormControl>
                                            <div className="relative">
                                                {!hasContent && !isDescriptionExpanded ? (
                                                    <button 
                                                        type="button"
                                                        onClick={() => setIsDescriptionExpanded(true)}
                                                        className="text-muted-foreground text-base text-left w-full hover:text-foreground transition-colors"
                                                    >
                                                        Add a description for your plan...
                                                    </button>
                                                ) : isDescriptionExpanded ? (
                                                    <div className="space-y-2">
                                                        <TextareaAutosize
                                                            placeholder="Add a description for your plan..."
                                                            className="w-full text-base text-foreground leading-relaxed resize-none border-0 shadow-none focus:outline-none focus-visible:ring-0 p-0 bg-transparent placeholder:text-muted-foreground"
                                                            name={field.name}
                                                            value={field.value || ''}
                                                            onChange={field.onChange}
                                                            minRows={3}
                                                            maxRows={8}
                                                            onBlur={() => {
                                                                field.onBlur();
                                                                // Use setTimeout to allow clicks on other elements to register first
                                                                setTimeout(() => {
                                                                    setIsDescriptionExpanded(false);
                                                                }, 150);
                                                            }}
                                                            autoFocus
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="text-base text-foreground leading-relaxed break-words overflow-hidden" style={{ maxHeight: '3rem', lineHeight: '1.5rem' }}>
                                                        <span className="whitespace-pre-wrap break-words">{truncatedText}</span>
                                                        {needsTruncation && (
                                                            <>
                                                                <span>... </span>
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => setIsDescriptionExpanded(true)}
                                                                    className="text-primary hover:text-primary/80 text-base font-medium inline"
                                                                >
                                                                    read more
                                                                </button>
                                                            </>
                                                        )}
                                                        {!needsTruncation && (
                                                            <button 
                                                                type="button"
                                                                onClick={() => setIsDescriptionExpanded(true)}
                                                                className="ml-2 text-muted-foreground hover:text-foreground text-sm inline"
                                                            >
                                                                edit
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </FormControl>
                                    </FormItem>
                                );
                            }}
                        />



                        <Accordion type="single" collapsible className="w-full" onValueChange={(value) => setIsAccordionOpen(!!value)}>
                            <AccordionItem value="item-1">
                                <AccordionTrigger className="text-muted-foreground hover:no-underline">
                                    <div className="flex items-center gap-3">
                                        <Users className="h-5 w-5" />
                                        <span className="font-semibold text-base text-foreground">Invite Friends</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <FormField
                                        control={form.control}
                                        name="invitedParticipantUserIds"
                                        render={({ field }) => (
                                            <FriendMultiSelectInput
                                                selectedUserIds={field.value || []}
                                                onSelectedUserIdsChange={field.onChange}
                                                onOpenChange={setIsFriendSearchOpen}
                                                autoOpen={true}
                                            />
                                        )}
                                    />
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        {fields.length > 0 && (
                            <div className="flex items-center justify-between px-2">
                                <h3 className="font-semibold text-base text-foreground">Itinerary</h3>
                                {fields.length > 1 && (
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                    {fields.map((_, idx) => (
                                        <div
                                        key={`dot-${idx}`}
                                        className={cn(
                                            'h-2 rounded-full transition-all duration-300',
                                            visibleStopIndex === idx ? 'w-5 bg-primary' : 'w-2 bg-muted-foreground'
                                        )}
                                        />
                                    ))}
                                    </div>
                                    <div className="flex items-center justify-center bg-muted/50 rounded-full px-2 py-0.5">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        {visibleStopIndex + 1}/{fields.length}
                                    </span>
                                    </div>
                                </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-grow flex items-center w-full min-w-0">
                        <div 
                        className="relative overflow-x-auto snap-x snap-mandatory scroll-smooth py-4 w-full hide-scrollbar"
                        style={{ WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none', scrollbarWidth: 'none' }}
                        onScroll={(e) => {
                            const container = e.currentTarget;
                            const totalItems = fields.length + 1;
                            if (totalItems <= 1) return;
                            const itemWidth = container.scrollWidth / totalItems;
                            const newIndex = Math.round(container.scrollLeft / itemWidth);
                            
                            if (newIndex < fields.length && newIndex !== visibleStopIndex) {
                              setAnimationDirection(newIndex > visibleStopIndex ? 'right' : 'left');
                              setVisibleStopIndex(newIndex);
                            }
                        }}
                        >
                            <div className="flex w-max min-w-full gap-4 px-[5vw] sm:px-[calc(50vw-212px)]">
                                {fields.map((field, index) => (
                                                                    <div 
                                    key={field.id} 
                                    className="w-[90vw] sm:w-[424px] h-[520px] flex-shrink-0 snap-center"
                                    ref={(el) => {
                                        itemRefs.current[index] = el;
                                    }}
                                >
                                    <ItineraryItem 
                                        index={index}
                                        isGoogleMapsApiLoaded={isGoogleMapsApiLoaded}
                                        onRemove={() => remove(index)}
                                        isActive={index === visibleStopIndex}
                                        animationDirection={animationDirection}
                                        onEnterReorderMode={handleEnterReorderMode}
                                        totalItems={fields.length}
                                    />
                                </div>
                                ))}
                                <div className="w-[90vw] sm:w-[424px] flex-shrink-0 snap-center">
                                    <div className="h-full min-h-[500px] flex items-center justify-center p-4">
                                        <button
                                            type="button"
                                            onClick={addNewStop}
                                            className="w-full h-full bg-input/50 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:bg-input hover:border-primary transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                                        >
                                            <PlusCircle className="h-12 w-12 mb-4" />
                                            <span className="text-lg font-semibold">Add Stop</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="px-4 pt-0 pb-6 sm:px-6 sm:pt-0 sm:pb-8 space-y-4 max-w-3xl mx-auto w-full">
                        {!isFriendSearchOpen && (
                            <div className="flex justify-between items-center">
                                <FormField control={form.control} name="status" render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className="w-auto bg-input border-border rounded-lg text-sm">
                                            <Globe className="h-4 w-4 mr-2" /> 
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-popover text-foreground border-border">
                                            <SelectItem value="draft">Draft</SelectItem>
                                            <SelectItem value="published">Public</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )} />

                                <Button 
                                    type="submit" 
                                    className={cn(
                                        "font-bold text-sm",
                                        planStatus === 'published' ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                                    )}
                                    disabled={isSubmitting || !isFormValid()}
                                    size="sm"
                                >
                                    {isSubmitting 
                                        ? (planStatus === 'published' ? 'Publishing...' : 'Saving...')
                                        : (planStatus === 'published' ? 'Publish Plan' : 'Save Draft')
                                    }
                                </Button>
                            </div>
                        )}
                        
                        {planStatus === 'published' && !isFormValid() && (
                            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                                💡 To publish your plan, please complete the first itinerary item with a location, time, and city.
                            </div>
                        )}
                    </div>
                </form>
            </Form>

            {isReorderModeActive && (
                <ReorderItineraryView
                    items={fields}
                    initialBounds={initialCardBounds}
                    onClose={() => setIsReorderModeActive(false)}
                    onSwap={swap}
                    onRemove={remove}
                />
            )}
        </div>
    );
}