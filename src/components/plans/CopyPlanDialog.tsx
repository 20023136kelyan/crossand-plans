'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DocumentDuplicateIcon, CalendarIcon, MapPinIcon, ClockIcon, UserGroupIcon, StarIcon, PhotoIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Plan, PriceRangeType } from '@/types/plan';
import { User } from 'firebase/auth';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CopyPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan;
  currentUser: User | null;
  onCopy: (customizations: PlanCopyCustomizations) => Promise<void>;
}

export interface PlanCopyCustomizations {
  name: string;
  description?: string;
  eventTime: string;
  location: string;
  city: string;
  priceRange: PriceRangeType;
  includeItinerary: boolean;
  includePhotos: boolean;
  makePrivate: boolean;
  customNotes?: string;
}

const priceRangeOptions = [
  { value: 'Free', label: 'Free', description: 'No cost' },
  { value: '$', label: '$', description: 'Budget-friendly ($1-25)' },
  { value: '$$', label: '$$', description: 'Moderate ($25-75)' },
  { value: '$$$', label: '$$$', description: 'Expensive ($75-200)' },
  { value: '$$$$', label: '$$$$', description: 'Very Expensive ($200+)' }
];

export function CopyPlanDialog({
  open,
  onOpenChange,
  plan,
  currentUser,
  onCopy
}: CopyPlanDialogProps) {
  const [name, setName] = useState(plan.isTemplate ? plan.name : `Copy of ${plan.name}`);
  const [description, setDescription] = useState(plan.description || '');
  const [eventDate, setEventDate] = useState<Date | undefined>(new Date());
  const [eventTime, setEventTime] = useState('12:00');
  const [location, setLocation] = useState(plan.location);
  const [city, setCity] = useState(plan.city);
  const [priceRange, setPriceRange] = useState<PriceRangeType>(plan.priceRange);
  const [includeItinerary, setIncludeItinerary] = useState(true);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [makePrivate, setMakePrivate] = useState(false);
  const [customNotes, setCustomNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!currentUser) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
              Sign In Required
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              You need to be signed in to copy this plan to your account.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={() => window.location.href = '/auth/signin'} className="flex-1">
                Sign In
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleSubmit = async () => {
    if (!eventDate) {
      return;
    }

    setIsSubmitting(true);
    try {
      const eventDateTime = new Date(eventDate);
      const [hours, minutes] = eventTime.split(':').map(Number);
      eventDateTime.setHours(hours, minutes);

      const customizations: PlanCopyCustomizations = {
        name: name.trim(),
        description: description.trim() || undefined,
        eventTime: eventDateTime.toISOString(),
        location: location.trim(),
        city: city.trim(),
        priceRange,
        includeItinerary,
        includePhotos,
        makePrivate,
        customNotes: customNotes.trim() || undefined
      };

      await onCopy(customizations);
      onOpenChange(false);
    } catch (error) {
      console.error('Error copying plan:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DocumentDuplicateIcon className="h-5 w-5" />
            {plan.isTemplate ? 'Use This Template' : 'Copy Plan to My Account'}
          </DialogTitle>
          {plan.isTemplate && (
            <p className="text-sm text-gray-600 mt-2">
              When you copy this template, you become the author of a new version. 
              The original template and its comments/ratings remain unchanged.
            </p>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {/* Original Plan Info */}
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <StarIcon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <MapPinIcon className="h-3 w-3" />
                    {plan.city}
                  </span>
                  <span className="flex items-center gap-1">
                    <UserGroupIcon className="h-3 w-3" />
                    {plan.itinerary.length} stops
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {plan.priceRange}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Customize Your Copy</h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-name">Plan Name *</Label>
                <Input
                  id="plan-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter a name for your plan"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan-description">Description</Label>
                <Textarea
                  id="plan-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your plan (optional)"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Date and Time */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">When</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Event Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !eventDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {eventDate ? format(eventDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={eventDate}
                      onSelect={setEventDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-time">Event Time *</Label>
                <Input
                  id="event-time"
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Where</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Event location"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
              </div>
            </div>
          </div>

          {/* Price Range */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Budget</h3>
            <Select value={priceRange} onValueChange={(value) => setPriceRange(value as PriceRangeType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priceRangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-sm text-gray-500">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Copy Options */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">What to Include</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Include Itinerary</Label>
                  <p className="text-xs text-gray-500">
                    Copy all {plan.itinerary.length} stops from the original plan
                  </p>
                </div>
                <Switch
                  checked={includeItinerary}
                  onCheckedChange={setIncludeItinerary}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Include Photos</Label>
                  <p className="text-xs text-gray-500">
                    Copy photo highlights from the original plan
                  </p>
                </div>
                <Switch
                  checked={includePhotos}
                  onCheckedChange={setIncludePhotos}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Make Private</Label>
                  <p className="text-xs text-gray-500">
                    Only you can see this plan (you can change this later)
                  </p>
                </div>
                <Switch
                  checked={makePrivate}
                  onCheckedChange={setMakePrivate}
                />
              </div>
            </div>
          </div>

          {/* Custom Notes */}
          <div className="space-y-2">
            <Label htmlFor="custom-notes">Personal Notes (Optional)</Label>
            <Textarea
              id="custom-notes"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="Add any personal notes or modifications you want to remember..."
              rows={3}
            />
          </div>

          {/* Attribution Notice */}
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-start gap-2">
              <CheckCircleIcon className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800">Attribution</p>
                <p className="text-blue-700">
                  Your copied plan will include a reference to the original creator. 
                  This helps support the community and gives credit where it's due.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !name.trim() || !location.trim() || !city.trim() || !eventDate}
          >
            {isSubmitting ? 'Copying...' : 'Copy to My Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}