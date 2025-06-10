'use client';

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { useCallback } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  CalendarIcon, 
  Loader2, 
  PlusCircle, 
  ListChecks, 
  MapPin as MapPinIcon, 
  ArrowLeft, 
  Users as UsersIcon, 
  Sparkles, 
  Building, 
  FileText, 
  MessageSquare, 
  Calendar as CalendarLucide, 
  DollarSign, 
  CheckCircle, 
  Settings,
  Clock,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid as isDateValid } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import React, { useState, useEffect, useMemo } from 'react';
import type { Plan, ItineraryItem as ItineraryItemType, TransitMode, PlanStatusType, PlanTypeType, PriceRangeType } from '@/types/user';
import { EditableItineraryItemCard } from './EditableItineraryItemCard';
import { FriendMultiSelectInput } from './FriendMultiSelectInput';
import { useJsApiLoader, type Libraries } from '@react-google-maps/api';
import { Separator } from '../ui/separator';

// Constants
const GOOGLE_MAPS_LIBRARIES: Libraries = ['places', 'geocoding', 'marker'];
const planStatusOptions = ['published', 'draft', 'cancelled'] as const;
const planTypeOptions = ['single-stop', 'multi-stop'] as const;
const priceRangeOptions = ['Free', '$', '$$', '$$$', '$$$$'] as const;
const transitModeValues = ['driving', 'walking', 'bicycling', 'transit'] as const;

// Schemas
export const itineraryItemSchema = z.object({
  id: z.string().uuid().default(() => crypto.randomUUID()),
  placeName: z.string().min(1, { message: "Place name is required." }),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  startTime: z.string().refine(val => isDateValid(parseISO(val)), { message: "Start time is required and must be a valid date." }),
  endTime: z.string().optional().nullable().refine(val => val === null || val === undefined || val === '' || isDateValid(parseISO(val)), { message: "Invalid end time format." }),
  description: z.string().optional().nullable(),
  googlePlaceId: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  googlePhotoReference: z.string().optional().nullable(),
  googleMapsImageUrl: z.string().url().optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
  reviewCount: z.number().int().min(0).optional().nullable(),
  activitySuggestions: z.array(z.string()).optional().nullable().default([]),
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
}).refine(data => {
  if (data.endTime && data.startTime && data.endTime !== '' && data.startTime !== '') {
    try {
      return parseISO(data.startTime) < parseISO(data.endTime);
    } catch (e) { return false; }
  }
  return true;
}, {
  message: "End time must be after start time.",
  path: ["endTime"],
});

export type ItineraryItemSchemaValues = z.infer<typeof itineraryItemSchema>;

const planFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, { message: 'Plan name must be at least 3 characters.' }).max(100),
  description: z.string().max(5000).optional().nullable(),
  eventDateTime: z.date({ required_error: 'Event date and time is required.' }),
  primaryLocation: z.string().min(2, { message: 'Primary location is required.' }).max(150),
  city: z.string().min(2, { message: 'City is required.' }).max(100),
  eventType: z.string().max(100).optional().nullable(),
  priceRange: z.enum(priceRangeOptions).optional().nullable(),
  invitedParticipantUserIds: z.array(z.string()).optional().default([]),
  status: z.enum(planStatusOptions),
  planType: z.enum(planTypeOptions),
  itinerary: z.array(itineraryItemSchema).min(1, "At least one itinerary item is required.").optional().default([]),
});

export type PlanFormValues = z.infer<typeof planFormSchema>;

// Types
interface PlanFormProps {
  initialData?: Plan | null;
  onSubmit: (data: PlanFormValues) => Promise<void>;
  isSubmitting?: boolean;
  formMode?: 'create' | 'edit';
  formTitle?: string;
  onBackToAICriteria?: () => void;
}

// Section Components
interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
}

function SectionHeader({ icon, title, description }: SectionHeaderProps) {
  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 border border-primary/20">
        {icon}
      </div>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

interface FormSectionProps {
  children: React.ReactNode;
  className?: string;
}

function FormSection({ children, className }: FormSectionProps) {
  return (
    <div className={cn("space-y-3 p-4 rounded-lg bg-card/30 border border-border/20", className)}>
      {children}
    </div>
  );
}

// Core Details Section
interface CoreDetailsSectionProps {
  form: any;
}

function CoreDetailsSection({ form }: CoreDetailsSectionProps) {
  return (
    <div className="space-y-3">
      <SectionHeader 
        icon={<Sparkles className="h-4 w-4 text-primary" />}
        title="Plan Basics"
        description="Essential details for your plan"
      />
      <FormSection>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium flex items-center space-x-1">
                  <FileText className="h-3 w-3 text-primary" />
                  <span>Plan Name</span>
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Give your plan a catchy name..." 
                    {...field} 
                    className="h-9 text-sm border-border/40 focus:border-primary/50 transition-colors" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="eventDateTime"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="text-sm font-medium flex items-center space-x-1">
                  <Clock className="h-3 w-3 text-primary" />
                  <span>Date & Time</span>
                  <span className="text-destructive">*</span>
                </FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button 
                        variant={'outline'} 
                        className={cn(
                          'w-full h-9 justify-start text-left font-normal border-border/40 hover:border-primary/50 transition-colors text-sm', 
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        {field.value && isDateValid(field.value) ? (
                          <span className="flex items-center space-x-1">
                            <CalendarIcon className="h-3 w-3 text-primary" />
                            <span>{format(field.value, 'MMM d, yyyy')}</span>
                            <Clock className="h-3 w-3 text-primary" />
                            <span>{format(field.value, 'p')}</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-1">
                            <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                            <span>Select date and time</span>
                          </span>
                        )}
                        <ChevronDown className="ml-auto h-3 w-3 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar 
                      mode="single" 
                      selected={field.value} 
                      onSelect={field.onChange} 
                      disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} 
                      initialFocus 
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </FormSection>
    </div>
  );
}

// Location Section
interface LocationSectionProps {
  form: any;
}

function LocationSection({ form }: LocationSectionProps) {
  return (
    <div className="space-y-3">
      <SectionHeader 
        icon={<MapPinIcon className="h-4 w-4 text-primary" />}
        title="Location Details"
        description="Where will your plan take place?"
      />
      <FormSection>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="primaryLocation"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium flex items-center space-x-1">
                  <MapPinIcon className="h-3 w-3 text-primary" />
                  <span>Primary Location</span>
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g., Central Park, Times Square" 
                    {...field} 
                    className="h-9 text-sm border-border/40 focus:border-primary/50 transition-colors" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium flex items-center space-x-1">
                  <Building className="h-3 w-3 text-primary" />
                  <span>City</span>
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g., New York, San Francisco" 
                    {...field} 
                    className="h-9 text-sm border-border/40 focus:border-primary/50 transition-colors" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </FormSection>
    </div>
  );
}

// Plan Details Section
interface PlanDetailsSectionProps {
  form: any;
}

function PlanDetailsSection({ form }: PlanDetailsSectionProps) {
  return (
    <div className="space-y-3">
      <SectionHeader 
        icon={<FileText className="h-4 w-4 text-primary" />}
        title="Plan Details"
        description="Tell us more about your plan"
      />
      <FormSection>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium flex items-center space-x-1">
                    <MessageSquare className="h-3 w-3 text-primary" />
                    <span>Description</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the overall plan, vibe, and what makes it special..." 
                      {...field} 
                      value={field.value ?? ''} 
                      className="min-h-[60px] text-sm border-border/40 focus:border-primary/50 transition-colors resize-none" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="space-y-3">
            <FormField
              control={form.control}
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium flex items-center space-x-1">
                    <CalendarLucide className="h-3 w-3 text-primary" />
                    <span>Event Type</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Birthday Party, Date Night" 
                      {...field} 
                      value={field.value ?? ''} 
                      className="h-9 text-sm border-border/40 focus:border-primary/50 transition-colors" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="priceRange"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium flex items-center space-x-1">
                    <DollarSign className="h-3 w-3 text-primary" />
                    <span>Price Range</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl ref={field.ref}>
                      <SelectTrigger className="h-9 text-sm border-border/40 focus:border-primary/50 transition-colors">
                        <SelectValue placeholder="Select budget" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {priceRangeOptions.map(opt => (
                        <SelectItem key={opt} value={opt} className="text-sm py-1">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </FormSection>
    </div>
  );
}

// Itinerary Section
interface ItinerarySectionProps {
  form: any;
  isGoogleMapsApiLoaded: boolean;
  googleMapsApiKey?: string;
}

function ItinerarySection({ form, isGoogleMapsApiLoaded, googleMapsApiKey }: ItinerarySectionProps) {
  const { fields, append, remove, move: originalMove } = useFieldArray({
    control: form.control,
    name: "itinerary",
  });

  // Custom move function that maintains chronological order
   const move = useCallback((fromIndex: number, toIndex: number) => {
     // Perform the original move
     originalMove(fromIndex, toIndex);
     
     // After moving, recalculate all time slots to maintain chronological order
     setTimeout(() => {
       const currentValues = form.getValues('itinerary');
       
       // Recalculate time slots for all items to maintain chronological order
       currentValues.forEach((item, index) => {
         if (index === 0) {
           // First item keeps its current time or uses current time if none
           if (!item.startTime) {
             const now = new Date();
             form.setValue(`itinerary.${index}.startTime`, now.toISOString());
             form.setValue(`itinerary.${index}.endTime`, new Date(now.getTime() + 60 * 60 * 1000).toISOString());
           }
         } else {
           // Subsequent items start 1 hour after the previous item ends
           const previousItem = currentValues[index - 1];
           if (previousItem && previousItem.endTime) {
             const previousEndTime = new Date(previousItem.endTime);
             const newStartTime = new Date(previousEndTime.getTime() + 60 * 60 * 1000);
             const newEndTime = new Date(newStartTime.getTime() + 60 * 60 * 1000);
             
             form.setValue(`itinerary.${index}.startTime`, newStartTime.toISOString());
             form.setValue(`itinerary.${index}.endTime`, newEndTime.toISOString());
           }
         }
       });
     }, 0);
   }, [originalMove, form]);

  const planType = useWatch({ control: form.control, name: "planType" });

  const addItineraryItem = () => {
    const currentItems = form.getValues('itinerary');
    const lastItem = currentItems[currentItems.length - 1];
    
    // Calculate start time: if there's a previous item, start 1 hour after its end time
    // Otherwise, start at current time
    let startTime: string;
    let endTime: string;
    
    if (lastItem && lastItem.endTime) {
      const lastEndTime = new Date(lastItem.endTime);
      startTime = new Date(lastEndTime.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour after last end
      endTime = new Date(lastEndTime.getTime() + 2 * 60 * 60 * 1000).toISOString(); // 1 hour duration
    } else if (lastItem && lastItem.startTime) {
      const lastStartTime = new Date(lastItem.startTime);
      startTime = new Date(lastStartTime.getTime() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours after last start (assuming 1h duration + 1h gap)
      endTime = new Date(lastStartTime.getTime() + 3 * 60 * 60 * 1000).toISOString(); // 1 hour duration
    } else {
      const now = new Date();
      startTime = now.toISOString();
      endTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour duration
    }

    const newItem: ItineraryItemSchemaValues = {
      id: crypto.randomUUID(),
      placeName: '',
      address: null,
      city: null,
      startTime,
      endTime,
      description: null,
      googlePlaceId: null,
      lat: null,
      lng: null,
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
    };
    append(newItem);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <ListChecks className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Event Itinerary</h3>
            <p className="text-xs text-muted-foreground hidden sm:block">Plan your stops and activities</p>
          </div>
        </div>
        <FormField
          control={form.control}
          name="planType"
          render={({ field }) => (
            <FormItem className="w-full sm:w-32">
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl ref={field.ref}>
                  <SelectTrigger className="h-8 text-xs border-border/40 focus:border-primary/50 transition-colors">
                    <SelectValue placeholder="Plan type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {planTypeOptions.map(opt => (
                    <SelectItem key={opt} value={opt} className="text-xs py-1">
                      {opt === 'single-stop' ? 'Single Stop' : 'Multi-Stop'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="space-y-2">
        <ItineraryItems 
          fields={fields}
          form={form}
          remove={remove}
          move={move}
          isGoogleMapsApiLoaded={isGoogleMapsApiLoaded}
        />
        
        {planType === 'multi-stop' && (
          <Button
            type="button"
            variant="outline"
            onClick={addItineraryItem}
            className="w-full h-8 border-dashed border-2 border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 text-xs"
          >
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
            Add Another Stop
          </Button>
        )}
      </div>
    </div>
  );
}

// Memoized ItineraryItems component to prevent unnecessary re-renders
interface ItineraryItemsProps {
  fields: any[];
  form: any;
  remove: (index: number) => void;
  move: (from: number, to: number) => void;
  isGoogleMapsApiLoaded: boolean;
}

const ItineraryItems = React.memo(({ fields, form, remove, move, isGoogleMapsApiLoaded }: ItineraryItemsProps) => {
  const itineraryValues = form.watch('itinerary');
  
  return (
    <>
      {fields.map((field, index) => {
        const previousItem = index > 0 ? itineraryValues[index - 1] : null;
        return (
          <EditableItineraryItemCard
            key={field.id}
            index={index}
            control={form.control}
            remove={remove}
            move={move}
            isGoogleMapsApiLoaded={isGoogleMapsApiLoaded}
            previousItemLat={previousItem?.lat || null}
            previousItemLng={previousItem?.lng || null}
            previousItemStartTime={previousItem?.startTime || null}
            previousItemEndTime={previousItem?.endTime || null}
            isFirst={index === 0}
            isLast={index === fields.length - 1}
            isOnlyItem={fields.length === 1}
          />
        );
      })}
    </>
  );
});

ItineraryItems.displayName = 'ItineraryItems';

// Participants Section
interface ParticipantsSectionProps {
  form: any;
}

function ParticipantsSection({ form }: ParticipantsSectionProps) {
  return (
    <div className="space-y-3">
      <SectionHeader 
        icon={<UsersIcon className="h-4 w-4 text-primary" />}
        title="Invite Participants"
        description="Who would you like to invite?"
      />
      <FormSection>
        <FriendMultiSelectInput
          control={form.control}
          name="invitedParticipantUserIds"
          label="Select friends to invite"
          description="They will be able to see this plan if it's published."
        />
      </FormSection>
    </div>
  );
}

// Finalize Section
interface FinalizeSectionProps {
  form: any;
}

function FinalizeSection({ form }: FinalizeSectionProps) {
  return (
    <div className="space-y-3">
      <SectionHeader 
        icon={<CheckCircle className="h-4 w-4 text-primary" />}
        title="Finalize & Publish"
        description="Set your plan's visibility and status"
      />
      <FormSection>
        <div className="max-w-xs">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium flex items-center space-x-1">
                  <Settings className="h-3 w-3 text-primary" />
                  <span>Plan Status</span>
                  <span className="text-destructive">*</span>
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl ref={field.ref}>
                    <SelectTrigger className="h-9 text-sm border-border/40 focus:border-primary/50 transition-colors">
                      <SelectValue placeholder="Choose plan visibility" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {planStatusOptions.map(opt => (
                      <SelectItem key={opt} value={opt} className="text-sm py-2">
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </FormSection>
    </div>
  );
}

// Main Component
export function PlanForm({ 
  initialData, 
  onSubmit, 
  isSubmitting: propIsSubmitting, 
  formMode: propFormMode, 
  formTitle, 
  onBackToAICriteria 
}: PlanFormProps) {
  const { toast } = useToast();
  const [isSubmittingForm, setIsSubmittingForm] = useState(propIsSubmitting || false);
  const formMode = propFormMode || (initialData?.id ? 'edit' : 'create');

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      id: initialData?.id,
      name: initialData?.name || '',
      description: initialData?.description || '',
      eventDateTime: initialData?.eventTime && isDateValid(parseISO(initialData.eventTime)) 
        ? parseISO(initialData.eventTime) 
        : new Date(),
      primaryLocation: initialData?.location || initialData?.itinerary?.[0]?.placeName || '',
      city: initialData?.city || initialData?.itinerary?.[0]?.city || '',
      eventType: initialData?.eventType || '',
      priceRange: initialData?.priceRange || 'Free',
      invitedParticipantUserIds: initialData?.invitedParticipantUserIds || [],
      status: initialData?.status || 'published',
      planType: initialData?.planType || 'single-stop',
      itinerary: initialData?.itinerary?.map(item => ({
        ...item,
        id: item.id || crypto.randomUUID(),
        startTime: item.startTime && isDateValid(parseISO(item.startTime)) 
          ? item.startTime 
          : new Date().toISOString(),
        endTime: item.endTime && isDateValid(parseISO(item.endTime)) 
          ? item.endTime 
          : undefined,
        activitySuggestions: item.activitySuggestions || [],
        openingHours: item.openingHours || [],
        types: item.types || [],
        durationMinutes: item.durationMinutes ?? 60,
        transitMode: item.transitMode ?? 'driving',
        transitTimeFromPreviousMinutes: item.transitTimeFromPreviousMinutes ?? null,
      })) || [{
        id: crypto.randomUUID(),
        placeName: '',
        address: null,
        city: null,
        startTime: new Date().toISOString(),
        endTime: null,
        description: null,
        googlePlaceId: null,
        lat: null,
        lng: null,
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
      }],
    },
  });

  useEffect(() => {
    setIsSubmittingForm(propIsSubmitting || false);
  }, [propIsSubmitting]);

  const processAndSubmit = async (data: PlanFormValues) => {
    try {
      setIsSubmittingForm(true);
      await onSubmit(data);
    } catch (error) {
      console.error("Error during form submission:", error);
      toast({ 
        title: "Submission Error", 
        description: "An unexpected error occurred.", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmittingForm(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(processAndSubmit)} className="flex flex-col h-full">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-background/98 to-background/95 backdrop-blur-md border-b border-border/30 px-3 py-2 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
              <h2 className="text-base font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                {formTitle || (formMode === 'edit' ? 'Edit Plan' : 'Create Plan')}
              </h2>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-3">
            {formMode === 'edit' 
              ? 'Update your plan details below' 
              : 'Create an amazing experience for you and your friends'
            }
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar-vertical">
          <ItinerarySection 
            form={form} 
            isGoogleMapsApiLoaded={isLoaded} 
            googleMapsApiKey={googleMapsApiKey} 
          />
          <Separator className="my-3 bg-border/30" />
          
          <CoreDetailsSection form={form} />
          <Separator className="my-3 bg-border/30" />
          
          <LocationSection form={form} />
          <Separator className="my-3 bg-border/30" />
          
          <PlanDetailsSection form={form} />
          <Separator className="my-3 bg-border/30" />
          
          <ParticipantsSection form={form} />
          <Separator className="my-3 bg-border/30" />
          
          <FinalizeSection form={form} />
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 left-0 right-0 p-3 bg-card/95 backdrop-blur-sm border-t border-border/30 z-10 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-2">
          {onBackToAICriteria && (
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onBackToAICriteria} 
              disabled={isSubmittingForm} 
              className="h-8 px-3 text-xs font-medium hover:bg-muted/50 transition-colors order-2 sm:order-1"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> 
              Back to AI
            </Button>
          )}
          <Button 
            type="submit" 
            disabled={isSubmittingForm || (!isLoaded && !!googleMapsApiKey && !loadError && formMode === 'create')} 
            className="h-8 px-4 text-xs font-semibold bg-primary hover:bg-primary/90 transition-all duration-200 shadow-lg hover:shadow-xl order-1 sm:order-2"
          >
            {(isSubmittingForm || (!isLoaded && !!googleMapsApiKey && !loadError && formMode === 'create')) && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            {formMode === 'create' 
              ? (initialData?.id ? 'Save Generated Plan' : 'Create Plan') 
              : 'Save Changes'
            }
          </Button>
        </div>
      </form>
    </Form>
  );
}

