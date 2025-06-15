'use client';


import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, useWatch, UseFieldArrayRemove } from 'react-hook-form';
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
import { Slider } from '@/components/ui/slider';
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
const planStatusOptions = ['published', 'draft', 'cancelled', 'archived', 'completed'] as const;
const creationStatusOptions = ['published', 'draft'] as const;
const editingStatusOptions = ['published', 'draft'] as const;
const planTypeOptions = ['single-stop', 'multi-stop'] as const;
const priceRangeOptions: Array<{ value: PriceRangeType | '', label: string }> = [
  { value: '', label: 'Any' },
  { value: 'Free', label: 'Free' },
  { value: '$', label: '$ (Cheap)' },
  { value: '$$', label: '$$ (Moderate)' },
  { value: '$$$', label: '$$$ (Pricey)' },
  { value: '$$$$', label: '$$$$ (Very Pricey)' },
];
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

// Helper function to validate if itinerary is complete and saved (not just autocompleting)
const isItineraryValid = (itinerary: ItineraryItemSchemaValues[]): boolean => {
  if (!itinerary || itinerary.length === 0) return false;
  
  return itinerary.every(item => {
    // Ensure all required fields are complete and not just partial autocomplete strings
    return item.placeName && item.placeName.trim().length > 0 && 
           item.address && item.address.trim().length > 0 && // Ensure address is saved
           item.city && item.city.trim().length > 0 && // Ensure city is saved
           item.startTime && isDateValid(parseISO(item.startTime)) &&
           item.lat && item.lng; // Ensure coordinates are saved (indicates place was selected, not just typed)
  });
};

// Helper function to extract auto-populated data from itinerary
const getAutoPopulatedData = (itinerary: ItineraryItemSchemaValues[]) => {
  if (!itinerary || itinerary.length === 0) return {};
  
  const firstItem = itinerary[0];
  const averagePriceLevel = itinerary.reduce((sum, item) => {
    return sum + (item.priceLevel || 0);
  }, 0) / itinerary.length;
  
  // Convert average price level to price range
  let priceRange: PriceRangeType = 'Free';
  if (averagePriceLevel >= 3.5) priceRange = '$$$$';
  else if (averagePriceLevel >= 2.5) priceRange = '$$$';
  else if (averagePriceLevel >= 1.5) priceRange = '$$';
  else if (averagePriceLevel >= 0.5) priceRange = '$';
  
  // Use the complete address as primary location, fallback to place name
  const primaryLocation = firstItem.address && firstItem.address.trim() ? firstItem.address : (firstItem.placeName || '');
  
  // Ensure we get the city from the saved itinerary item
  const city = firstItem.city && firstItem.city.trim() ? firstItem.city : '';
  
  // Extract photo highlights from itinerary items with images
  const photoHighlights: string[] = [];
  for (const item of itinerary) {
    if (item.googleMapsImageUrl && item.googleMapsImageUrl.trim()) {
      photoHighlights.push(item.googleMapsImageUrl);
    }
  }
  
  return {
    primaryLocation,
    city,
    eventDateTime: firstItem.startTime ? parseISO(firstItem.startTime) : undefined,
    priceRange: averagePriceLevel > 0 ? priceRange : undefined,
    photoHighlights: photoHighlights.length > 0 ? photoHighlights : undefined,
  };
};

export type ItineraryItemSchemaValues = z.infer<typeof itineraryItemSchema>;

const planFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, { message: 'Plan name must be at least 3 characters.' }).max(100),
  description: z.string().max(5000).optional().nullable(),
  eventDateTime: z.date({ required_error: 'Event date and time is required.' }),
  primaryLocation: z.string().min(2, { message: 'Primary location is required.' }).max(150),
  city: z.string().min(2, { message: 'City is required.' }).max(100),
  eventType: z.string().max(100).optional().nullable(),
  priceRange: z.enum(['Free', '$', '$$', '$$$', '$$$$']).optional().nullable(),
  invitedParticipantUserIds: z.array(z.string()).optional().default([]),
  status: z.enum(planStatusOptions),
  planType: z.enum(planTypeOptions),
  itinerary: z.array(itineraryItemSchema).min(1, "At least one itinerary item is required.").optional().default([]),
  photoHighlights: z.array(z.string().url()).optional().default([]),
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
  isCollapsible?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

function SectionHeader({ icon, title, description, isCollapsible = false, isExpanded = true, onToggle }: SectionHeaderProps) {
  return (
    <div 
      className={cn(
        "flex items-center justify-between w-full",
        isCollapsible && "cursor-pointer hover:bg-muted/30 rounded-md p-2 -m-2 transition-colors"
      )}
      onClick={isCollapsible ? onToggle : undefined}
    >
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
      {isCollapsible && (
        <ChevronDown 
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isExpanded && "rotate-180"
          )} 
        />
      )}
    </div>
  );
}

interface FormSectionProps {
  children: React.ReactNode;
  className?: string;
}

function FormSection({ children, className }: FormSectionProps) {
  return (
    <div className={cn("group bg-card/80 backdrop-blur-sm border border-border/40 rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 space-y-4", className)}>
      {children}
    </div>
  );
}

interface CollapsibleSectionProps {
  header: React.ReactNode;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
}

function CollapsibleSection({ header, children, isExpanded, onToggle, className }: CollapsibleSectionProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div onClick={(e) => {
        // Only allow toggling if the click is on the header itself, not on form elements
        const target = e.target as HTMLElement;
        if (!target.closest('button, input, select, [role="combobox"], [role="option"]')) {
          onToggle();
        }
      }}>
        {header}
      </div>
      <div 
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        {children}
      </div>
    </div>
  );
}

// Core Details Section
interface CoreDetailsSectionProps {
  form: any;
}

function CoreDetailsSection({ form, isExpanded, onToggle }: CoreDetailsSectionProps & { isExpanded: boolean; onToggle: () => void }) {
  return (
    <CollapsibleSection
      header={
        <SectionHeader 
          icon={<Sparkles className="h-4 w-4 text-primary" />}
          title="Plan Basics"
          description="Essential details for your plan"
          isCollapsible={true}
          isExpanded={isExpanded}
          onToggle={onToggle}
        />
      }
      isExpanded={isExpanded}
      onToggle={onToggle}
    >
      <FormSection>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input 
                    placeholder="Plan Name *" 
                    {...field} 
                    className="h-10 text-sm border-border/40 focus:border-primary/50 transition-colors" 
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
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button 
                        variant={'outline'} 
                        className={cn(
                          'w-full h-10 justify-start text-left font-normal border-border/40 hover:border-primary/50 transition-colors text-sm', 
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        {field.value && isDateValid(field.value) ? (
                          <span className="flex items-center space-x-1">
                            <CalendarIcon className="h-4 w-4 text-primary" />
                            <span>{format(field.value, 'MMM d, yyyy')}</span>
                            <Clock className="h-4 w-4 text-primary" />
                            <span>{format(field.value, 'p')}</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-1">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                            <span>Event Date & Time *</span>
                          </span>
                        )}
                        <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
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
    </CollapsibleSection>
  );
}

// Location Section
interface LocationSectionProps {
  form: any;
}

function LocationSection({ form, isExpanded, onToggle }: LocationSectionProps & { isExpanded: boolean; onToggle: () => void }) {
  return (
    <CollapsibleSection
      header={
        <SectionHeader 
          icon={<MapPinIcon className="h-4 w-4 text-primary" />}
          title="Starting Location Details"
          description="Where your itinerary begins. These fields are auto-filled from your completed itinerary."
          isCollapsible={true}
          isExpanded={isExpanded}
          onToggle={onToggle}
        />
      }
      isExpanded={isExpanded}
      onToggle={onToggle}
    >
      <FormSection>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="primaryLocation"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium flex items-center space-x-1">
                  <MapPinIcon className="h-3 w-3 text-primary" />
                  <span>Starting Location</span>
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g., Central Park, Times Square (auto-filled from first itinerary stop)" 
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
                  <span>Starting City</span>
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g., New York, San Francisco (auto-filled from itinerary)" 
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
    </CollapsibleSection>
  );
}

// Plan Details Section
interface PlanDetailsSectionProps {
  form: any;
}

function PlanDetailsSection({ form, isExpanded, onToggle }: PlanDetailsSectionProps & { isExpanded: boolean; onToggle: () => void }) {
  return (
    <CollapsibleSection
      header={
        <SectionHeader 
          icon={<FileText className="h-4 w-4 text-primary" />}
          title="Plan Details"
          description="Tell us more about your plan"
          isCollapsible={true}
          isExpanded={isExpanded}
          onToggle={onToggle}
        />
      }
      isExpanded={isExpanded}
      onToggle={onToggle}
    >
      <FormSection>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-muted-foreground mb-2">Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the overall plan, vibe, and what makes it special..." 
                      {...field} 
                      value={field.value ?? ''} 
                      className="min-h-[100px] text-sm border-border/40 focus:border-primary/50 transition-colors resize-none" 
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
                  <FormControl>
                    <Input 
                      placeholder="Event Type" 
                      {...field} 
                      value={field.value ?? ''} 
                      className="h-10 text-sm border-border/40 focus:border-primary/50 transition-colors" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="priceRange"
              render={({ field }) => {
                const priceIndex = priceRangeOptions.findIndex(option => option.value === field.value);
                const currentIndex = priceIndex === -1 ? 0 : priceIndex;
                
                return (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-sm font-medium text-muted-foreground">Price Range</FormLabel>
                    <div className="space-y-3">
                      <FormControl>
                        <Slider
                          value={[currentIndex]}
                          onValueChange={(value) => {
                            const selectedOption = priceRangeOptions[value[0]];
                            field.onChange(selectedOption.value === '' ? null : selectedOption.value as PriceRangeType);
                          }}
                          min={0}
                          max={priceRangeOptions.length - 1}
                          step={1}
                          className="[&>span:first-child]:h-3 [&>span>span]:h-3 [&>button]:h-6 [&>button]:w-6 [&>button]:border-2 [&>button]:shadow-md [&>button]:bg-primary [&>button]:border-primary [&>button]:touch-manipulation py-2"
                        />
                      </FormControl>
                      {/* Notch Labels */}
                      <div className="flex justify-between text-xs text-muted-foreground px-1">
                        {priceRangeOptions.map((option, index) => {
                          // Show simplified labels: Any, Free, then just dollar signs
                          let displayLabel = option.label;
                          if (option.value === '$') displayLabel = '$';
                          else if (option.value === '$$') displayLabel = '$$';
                          else if (option.value === '$$$') displayLabel = '$$$';
                          else if (option.value === '$$$$') displayLabel = '$$$$';
                          
                          return (
                            <span 
                              key={option.value} 
                              className={cn(
                                "transition-colors duration-200 text-center flex-1",
                                index === currentIndex ? "text-primary font-medium" : "hover:text-foreground"
                              )}
                            >
                              {displayLabel}
                            </span>
                          );
                        })}
                      </div>
                      {/* Current Selection Display */}
                      <div className="text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                          {priceRangeOptions[currentIndex].label}
                        </span>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          </div>
        </div>
      </FormSection>
    </CollapsibleSection>
  );
}

// Itinerary Section
interface ItinerarySectionProps {
  form: any;
  isGoogleMapsApiLoaded: boolean;
  googleMapsApiKey?: string;
}

function ItinerarySection({ form, isGoogleMapsApiLoaded, googleMapsApiKey }: ItinerarySectionProps) {
  const { fields, append, remove: originalRemove, move: originalMove } = useFieldArray({
    control: form.control,
    name: "itinerary",
  });

  // Wrapper for remove function to match UseFieldArrayRemove type
  const remove: UseFieldArrayRemove = useCallback((index?: number | number[]) => {
    originalRemove(index);
  }, [originalRemove]);

  // Custom move function that keeps time slots static
   const move = useCallback((fromIndex: number, toIndex: number) => {
     // Get current values before moving
     const currentValues = form.getValues('itinerary');
     
     // Store the time slots in their original positions
     const timeSlots = currentValues.map((item: ItineraryItemSchemaValues) => ({
       startTime: item.startTime,
       endTime: item.endTime
     }));
     
     // Perform the original move
     originalMove(fromIndex, toIndex);
     
     // After moving, restore time slots to their original positions
     setTimeout(() => {
       const movedValues = form.getValues('itinerary');
       
       // Apply the original time slots to the moved items
       movedValues.forEach((item: ItineraryItemSchemaValues, index: number) => {
         if (timeSlots[index]) {
           form.setValue(`itinerary.${index}.startTime`, timeSlots[index].startTime);
           form.setValue(`itinerary.${index}.endTime`, timeSlots[index].endTime);
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
      address: '',
      city: '',
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
        <div></div>
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
  remove: UseFieldArrayRemove;
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

function ParticipantsSection({ form, isExpanded, onToggle }: ParticipantsSectionProps & { isExpanded: boolean; onToggle: () => void }) {
  return (
    <CollapsibleSection
      header={
        <SectionHeader 
          icon={<UsersIcon className="h-4 w-4 text-primary" />}
          title="Invite Participants"
          description="Who would you like to invite?"
          isCollapsible={true}
          isExpanded={isExpanded}
          onToggle={onToggle}
        />
      }
      isExpanded={isExpanded}
      onToggle={onToggle}
    >
      <FormSection>
        <FriendMultiSelectInput
          control={form.control}
          name="invitedParticipantUserIds"
          label="Select friends to invite"
          description="They will be able to see this plan if it's published."
        />
      </FormSection>
    </CollapsibleSection>
  );
}

// Finalize Section
interface FinalizeSectionProps {
  form: any;
  formMode: 'create' | 'edit';
}

function FinalizeSection({ form, formMode, isExpanded, onToggle }: FinalizeSectionProps & { isExpanded: boolean; onToggle: () => void }) {
  return (
    <CollapsibleSection
      header={
        <SectionHeader 
          icon={<CheckCircle className="h-4 w-4 text-primary" />}
          title="Finalize & Publish"
          description="Set your plan's visibility and status"
          isCollapsible={true}
          isExpanded={isExpanded}
          onToggle={onToggle}
        />
      }
      isExpanded={isExpanded}
      onToggle={onToggle}
    >
      <FormSection>
        <div className="max-w-xs">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl ref={field.ref}>
                    <SelectTrigger className="h-11 text-sm border-border/40 focus:border-primary/50 transition-colors">
                      <SelectValue placeholder="Plan Status *" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(formMode === 'create' ? creationStatusOptions : editingStatusOptions).map(opt => (
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
    </CollapsibleSection>
  );
}

// Main Component
export function PlanForm({ 
  initialData, 
  onSubmit, 
  isSubmitting: propIsSubmitting = false, 
  formMode: propFormMode,
  formTitle,
  onBackToAICriteria 
}: PlanFormProps) {
  const { toast } = useToast();
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [hasValidatedItinerary, setHasValidatedItinerary] = useState(false);
  const [hasAutoPopulated, setHasAutoPopulated] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [allowSubmission, setAllowSubmission] = useState(false);
  const formMode = propFormMode || (initialData?.id ? 'edit' : 'create');

  // Step navigation
  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  const goToNextStep = () => {
    if (currentStep < 4) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Step definitions
  const steps = [
    { id: 1, title: 'Build Itinerary', description: 'Add places and activities' },
    { id: 2, title: 'Plan Information', description: 'Basic details and location' },
    { id: 3, title: 'Additional Details', description: 'Description and participants' },
    { id: 4, title: 'Review & Publish', description: 'Finalize your plan' }
  ];

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
    version: "beta",
    mapIds: ['crossand-plans-map'],
  });

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    mode: 'onChange',
    defaultValues: {
      id: initialData?.id || undefined,
      name: initialData?.name || '',
      description: initialData?.description || '',
      eventDateTime: initialData?.eventTime ? new Date(initialData.eventTime) : new Date(),
      primaryLocation: initialData?.primaryLocation || '',
      city: initialData?.city || '',
      eventType: initialData?.eventType || '',
      priceRange: initialData?.priceRange || undefined,
      invitedParticipantUserIds: initialData?.invitedParticipantUserIds || [],
      status: initialData?.status || 'published',
      planType: initialData?.planType || 'single-stop',
      photoHighlights: initialData?.photoHighlights || [],
      itinerary: initialData?.itinerary?.length ? initialData.itinerary.map(item => ({
        ...item,
        startTime: item.startTime || undefined,
        endTime: item.endTime || undefined,
      })) : [{
        id: crypto.randomUUID(),
        placeName: '',
        address: '',
        city: '',
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

  // Step validation
  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1: // Itinerary
        return hasValidatedItinerary;
      case 2: // Plan Information
        const values = form.getValues();
        return !!(values.name && values.eventDateTime && values.primaryLocation && values.city);
      case 3: // Additional Details
        return true; // Optional fields
      case 4: // Review & Publish
        return !!(form.getValues().status);
      default:
        return false;
    }
  };

  const canProceedToNext = isStepValid(currentStep);

  // Watch itinerary changes for validation and auto-population
  const currentItinerary = useWatch({ control: form.control, name: 'itinerary' });
  
  // Check if itinerary is valid and handle auto-population
  useEffect(() => {
    if (currentItinerary && isItineraryValid(currentItinerary)) {
      setHasValidatedItinerary(true);
      
      // Auto-populate fields only once when itinerary becomes valid
      if (!hasAutoPopulated && formMode === 'create') {
        const autoData = getAutoPopulatedData(currentItinerary);
        
        // Only update fields that are empty
        const currentValues = form.getValues();
        if (!currentValues.primaryLocation && autoData.primaryLocation) {
          form.setValue('primaryLocation', autoData.primaryLocation);
        }
        if (!currentValues.city && autoData.city) {
          form.setValue('city', autoData.city);
        }
        if (autoData.eventDateTime && !currentValues.eventDateTime) {
          form.setValue('eventDateTime', autoData.eventDateTime);
        }
        if (autoData.priceRange && !currentValues.priceRange) {
          form.setValue('priceRange', autoData.priceRange);
        }
        if (autoData.photoHighlights && autoData.photoHighlights.length > 0 && (!currentValues.photoHighlights || currentValues.photoHighlights.length === 0)) {
          form.setValue('photoHighlights', autoData.photoHighlights);
        }
        
        setHasAutoPopulated(true);
      }
    } else {
      setHasValidatedItinerary(false);
    }
  }, [currentItinerary, hasAutoPopulated, formMode, form]);
  
  // For edit mode, start at step 4 (review) and mark all steps as completed
  useEffect(() => {
    if (formMode === 'edit' && initialData?.itinerary?.length) {
      setHasValidatedItinerary(true);
      setHasAutoPopulated(true);
      setCurrentStep(4);
      setCompletedSteps(new Set([1, 2, 3]));
      // Prevent automatic submission on initial load
      setTimeout(() => setIsInitialLoad(false), 1000);
    } else {
      // For create mode, allow submissions after a short delay
      setTimeout(() => setIsInitialLoad(false), 500);
    }
  }, [formMode, initialData]);

  useEffect(() => {
    setIsSubmittingForm(propIsSubmitting || false);
  }, [propIsSubmitting]);

  const processAndSubmit = async (data: PlanFormValues, event?: React.FormEvent) => {
    // Debug logging to track automatic submissions
    console.log('Form submission triggered:', {
      currentStep,
      formMode,
      hasInitialData: !!initialData,
      isInitialLoad,
      eventType: event?.type,
      eventTarget: event?.target,
      eventIsTrusted: event?.isTrusted,
      timestamp: new Date().toISOString()
    });
    
    // Prevent submission during initial load
    if (isInitialLoad) {
      console.warn('Form submission prevented: initial load period');
      event?.preventDefault();
      return;
    }
    
    // Prevent programmatic submissions (not triggered by user interaction)
    if (event && !event.isTrusted) {
      console.warn('Form submission prevented: programmatic submission detected');
      event.preventDefault();
      return;
    }
    
    // Only allow submission on step 4 and when explicitly allowed
      if (currentStep !== 4 || !allowSubmission) {
        console.warn('Form submission prevented:', { currentStep, allowSubmission });
        event?.preventDefault();
        return;
      }
      
      // Reset submission flag after use
      setAllowSubmission(false);
    
    // Add a small delay to prevent accidental rapid submissions
    if (event && event.type === 'submit') {
      // Check if this is a programmatic submission vs user-initiated
      const isUserInitiated = event.isTrusted !== false;
      if (!isUserInitiated) {
        console.warn('Programmatic form submission detected, adding delay');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
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
      <form onSubmit={(e) => form.handleSubmit((data) => processAndSubmit(data, e))(e)} className="flex flex-col h-full bg-gradient-to-br from-background via-background/95 to-background/90">
        {/* Modern Header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-xl border-b border-border/20 px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
                {currentStep === 1 && <ListChecks className="h-5 w-5 text-primary" />}
                {currentStep === 2 && <FileText className="h-5 w-5 text-primary" />}
                {currentStep === 3 && <MessageSquare className="h-5 w-5 text-primary" />}
                {currentStep === 4 && <CheckCircle className="h-5 w-5 text-primary" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {steps[currentStep - 1].title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {steps[currentStep - 1].description}
                </p>
              </div>
            </div>
            <div className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
              {currentStep}/{steps.length}
            </div>
          </div>
        </div>

        {/* Compact Progress Indicator */}
        <div className="px-4 py-2 bg-muted/20">
          <div className="relative">
            {/* Progress Bar */}
            <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-700 ease-out rounded-full"
                style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
              />
            </div>
            
            {/* Step Dots */}
            <div className="flex justify-between absolute -top-1 left-0 right-0">
              {steps.map((step, index) => (
                <div 
                  key={step.id}
                  className={cn(
                    "w-4 h-4 rounded-full transition-all duration-300 cursor-pointer border-2 shadow-sm",
                    currentStep === step.id 
                      ? "bg-primary border-primary scale-110 shadow-primary/25" 
                      : completedSteps.has(step.id)
                        ? "bg-primary/70 border-primary/70"
                        : "bg-background border-muted-foreground/30 hover:border-primary/50"
                  )}
                  onClick={() => {
                    if (completedSteps.has(step.id) || step.id <= currentStep) {
                      goToStep(step.id);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Modern Content Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar-vertical">
          {/* Step 1: Itinerary */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <ItinerarySection 
                form={form} 
                isGoogleMapsApiLoaded={isLoaded} 
                googleMapsApiKey={googleMapsApiKey} 
              />
              
              {!hasValidatedItinerary && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 shadow-sm">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <CheckCircle className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">Complete Your Itinerary</h3>
                  </div>
                  <p className="text-sm text-muted-foreground ml-8">
                    Please add at least one stop with a name and start time to continue.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Plan Information */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <CoreDetailsSection form={form} isExpanded={true} onToggle={() => {}} />
              <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
              <LocationSection form={form} isExpanded={true} onToggle={() => {}} />
            </div>
          )}

          {/* Step 3: Additional Details */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <PlanDetailsSection form={form} isExpanded={true} onToggle={() => {}} />
              <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
              <ParticipantsSection form={form} isExpanded={true} onToggle={() => {}} />
            </div>
          )}

          {/* Step 4: Review & Publish */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {/* Modern Summary Card */}
              <div className="p-6 rounded-xl bg-gradient-to-br from-card/50 to-card/30 border border-border/30 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <span>Plan Summary</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-muted-foreground min-w-[60px]">Name:</span>
                      <span className="text-foreground">{form.watch('name') || 'Untitled Plan'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-muted-foreground min-w-[60px]">Date:</span>
                      <span className="text-foreground">{form.watch('eventDateTime') ? format(form.watch('eventDateTime'), 'PPP p') : 'Not set'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-muted-foreground min-w-[60px]">Stops:</span>
                      <span className="text-foreground">{form.watch('itinerary')?.length || 0} location(s)</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-muted-foreground min-w-[60px]">Location:</span>
                      <span className="text-foreground">{form.watch('primaryLocation') || 'Not set'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-muted-foreground min-w-[60px]">City:</span>
                      <span className="text-foreground">{form.watch('city') || 'Not set'}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <FinalizeSection form={form} formMode={formMode} isExpanded={true} onToggle={() => {}} />
            </div>
          )}
        </div>

        {/* Modern Navigation */}
        <div className="relative bg-card/50 backdrop-blur-sm border-t border-border/20">
          <div className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2">
                {currentStep > 1 && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={goToPreviousStep}
                    className="h-9 px-4 text-sm font-medium border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 rounded-lg shadow-sm hover:shadow-md"
                  >
                    <ArrowLeft className="mr-1 h-3.5 w-3.5" /> 
                    Previous
                  </Button>
                )}
                
                {/* Back to AI Button (only on first step) */}
                {onBackToAICriteria && currentStep === 1 && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={onBackToAICriteria} 
                    disabled={isSubmittingForm} 
                    className="h-9 px-4 text-sm font-medium hover:bg-muted/50 transition-colors rounded-lg"
                  >
                    <ArrowLeft className="mr-1 h-3.5 w-3.5" /> 
                    Back to AI Generation
                  </Button>
                )}
              </div>
              
              {currentStep < 4 ? (
                <Button 
                  type="button" 
                  onClick={goToNextStep}
                  disabled={!canProceedToNext}
                  className="h-9 px-6 text-sm font-semibold bg-gradient-to-r from-primary via-primary/95 to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                >
                  Continue
                  <ChevronDown className="ml-1 h-3.5 w-3.5 rotate-[-90deg]" />
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  onClick={() => setAllowSubmission(true)}
                  disabled={isSubmittingForm || (!isLoaded && !!googleMapsApiKey && !loadError && formMode === 'create')} 
                  className="h-9 px-6 text-sm font-semibold bg-gradient-to-r from-green-600 via-green-500 to-green-400 hover:from-green-500 hover:to-green-300 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-lg"
                >
                  {(isSubmittingForm || (!isLoaded && !!googleMapsApiKey && !loadError && formMode === 'create')) && (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  )}
                  {formMode === 'create' 
                    ? (initialData?.id ? 'Save Generated Plan' : 'Publish Plan') 
                    : 'Save Changes'
                  }
                </Button>
              )}
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}

