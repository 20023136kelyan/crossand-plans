'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Activity, Calendar, Camera, Heart, MapPin, Phone, User, Users, Utensils, Clock, ArrowLeft, Save, Loader2, ChevronsUpDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { updateUserProfileAction } from '@/app/actions/userActions';
import { countries } from '../../onboarding/countries';
import { getCountryFlagEmoji } from '../../../../lib/country-utils';

// Preference options constants
const commonAllergies = ["Peanuts", "Shellfish", "Dairy", "Gluten", "Soy", "Eggs", "Tree Nuts", "Fish", "Sesame", "Mustard", "Wheat", "Celery", "Lupin", "Molluscs", "Sulphites"];
const commonDietaryRestrictions = ["Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Nut-Free", "Soy-Free", "Halal", "Kosher", "Paleo", "Keto", "Low FODMAP", "Pescatarian", "No Pork", "No Red Meat"];
const commonFavoriteCuisines = ["Italian", "Mexican", "Chinese", "Indian", "Japanese", "Thai", "Mediterranean", "French", "American", "Korean", "Vietnamese", "Spanish", "Greek", "Lebanese", "Brazilian", "Caribbean"];
const commonActivityTypes = ["Hiking", "Concerts", "Museums", "Dining Out", "Sports Events", "Movies", "Reading", "Board Games", "Nightlife", "Volunteering", "Cooking Class", "Art Workshop", "Photography", "Yoga/Meditation", "Dancing", "Travel", "Gaming", "Outdoor Sports"];
const commonPhysicalLimitations = ["Difficulty with stairs", "Limited mobility (long distance)", "Wheelchair user", "Visual impairment", "Hearing impairment", "Requires frequent breaks", "Cannot stand for long periods"];
const commonEnvironmentalSensitivities = ["Smoke", "Loud Noises", "Bright Lights", "Strong Scents", "Pollen", "Dust", "Crowds", "Temperature Extremes"];
const preferredGroupSizeOptions = ["Solo", "One-on-one", "Small (2-4 people)", "Medium (5-8 people)", "Large (8+ people)", "No preference"];
const interactionLevelOptions = ["Mostly observing", "Balanced", "Very talkative", "No preference"];
const travelToleranceOptions = ["Within walking distance", "Up to 15 minutes", "Up to 30 minutes", "Up to 1 hour", "Any distance for the right event"];

const editProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must be less than 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters'),
  bio: z.string().max(160, 'Bio must be less than 160 characters').optional(),
  selectedCountryCode: z.string().nullable().optional(),
  phoneNumber: z.string().optional(),
  birthDate: z.string().optional(),
  physicalAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  // Preferences and dietary information
  allergies: z.array(z.string()).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  generalPreferences: z.string().optional(),
  favoriteCuisines: z.array(z.string()).optional(),
  physicalLimitations: z.array(z.string()).optional(),
  activityTypePreferences: z.array(z.string()).optional(),
  activityTypeDislikes: z.array(z.string()).optional(),
  environmentalSensitivities: z.array(z.string()).optional(),
  travelTolerance: z.string().optional(),
  budgetFlexibilityNotes: z.string().optional(),
  socialPreferences: z.object({
    preferredGroupSize: z.string().nullable().optional(),
    interactionLevel: z.string().nullable().optional(),
  }).optional(),
  availabilityNotes: z.string().optional(),
});

type EditProfileFormValues = z.infer<typeof editProfileSchema>;

// Multi-select component for preferences
interface MultiSelectProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ options, value, onChange, placeholder, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = options.filter(option =>
    !searchTerm || option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter(item => item !== option));
    } else {
      onChange([...value, option]);
    }
  };

  const handleRemove = (option: string) => {
    onChange(value.filter(item => item !== option));
  };

  const handleCustomAdd = () => {
    if (searchTerm.trim() && !value.includes(searchTerm.trim()) && !options.includes(searchTerm.trim())) {
      onChange([...value, searchTerm.trim()]);
      setSearchTerm('');
    }
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(item => (
            <Badge key={item} variant="secondary" className="text-xs h-6 px-2 py-0.5">
              {item}
              <button
                type="button"
                className="ml-1 rounded-full outline-none ring-offset-background focus:ring-1 focus:ring-ring focus:ring-offset-1"
                onClick={() => !disabled && handleRemove(item)}
                disabled={disabled}
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between text-sm h-10 px-3 py-2 text-muted-foreground"
            disabled={disabled}
          >
            {placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput
              placeholder="Search or add custom..."
              value={searchTerm}
              onValueChange={setSearchTerm}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchTerm.trim()) {
                  e.preventDefault();
                  handleCustomAdd();
                }
              }}
              className="h-9 text-sm"
            />
            <CommandList>
              <CommandEmpty>
                {searchTerm.trim() && !options.includes(searchTerm.trim())
                  ? "Press Enter to add custom item."
                  : "No results found."}
              </CommandEmpty>
              <ScrollArea className="h-[200px]">
                <CommandGroup>
                  {filteredOptions.map(option => (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() => handleSelect(option)}
                      className="text-sm"
                    >
                      <Check className={cn("mr-2 h-4 w-4", value.includes(option) ? "opacity-100" : "opacity-0")} />
                      {option}
                    </CommandItem>
                  ))}
                  {searchTerm.trim() && !options.includes(searchTerm.trim()) && !value.includes(searchTerm.trim()) && (
                    <CommandItem
                      key={`add-${searchTerm.trim()}`}
                      value={searchTerm.trim()}
                      onSelect={handleCustomAdd}
                      className="text-sm italic"
                    >
                      <Check className="mr-2 h-4 w-4 opacity-0" />
                      Add "{searchTerm.trim()}"
                    </CommandItem>
                  )}
                </CommandGroup>
              </ScrollArea>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default function EditProfilePage() {
  const { user, currentUserProfile, refreshProfileStatus } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCountryPickerOpen, setIsCountryPickerOpen] = useState(false);
  const [countrySearchTerm, setCountrySearchTerm] = useState('');

  // Fallback/migration: split legacy name if needed
  function splitLegacyName(name: string | null | undefined): { firstName: string; lastName: string } {
    if (!name) return { firstName: '', lastName: '' };
    const parts = name.trim().split(' ');
    return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' };
  }

  const { firstName: legacyFirst, lastName: legacyLast } = splitLegacyName(currentUserProfile?.name);

  const form = useForm<EditProfileFormValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      firstName: currentUserProfile?.firstName || legacyFirst || '',
      lastName: currentUserProfile?.lastName || legacyLast || '',
      bio: currentUserProfile?.bio || '',
      selectedCountryCode: null,
      phoneNumber: currentUserProfile?.phoneNumber || '',
      birthDate: currentUserProfile?.birthDate && typeof currentUserProfile.birthDate !== 'string' && typeof (currentUserProfile.birthDate as any)?.toDate === 'function'
        ? (currentUserProfile.birthDate as any).toDate().toISOString().split('T')[0]
        : (typeof currentUserProfile?.birthDate === 'string' ? currentUserProfile.birthDate.split('T')[0] : ''),
      physicalAddress: {
        street: currentUserProfile?.physicalAddress?.street || '',
        city: currentUserProfile?.physicalAddress?.city || '',
        state: currentUserProfile?.physicalAddress?.state || '',
        zipCode: currentUserProfile?.physicalAddress?.zipCode || '',
        country: currentUserProfile?.physicalAddress?.country || '',
      },
      allergies: currentUserProfile?.allergies || [],
      dietaryRestrictions: currentUserProfile?.dietaryRestrictions || [],
      generalPreferences: currentUserProfile?.generalPreferences || '',
      favoriteCuisines: currentUserProfile?.favoriteCuisines || [],
      physicalLimitations: currentUserProfile?.physicalLimitations || [],
      activityTypePreferences: currentUserProfile?.activityTypePreferences || [],
      activityTypeDislikes: currentUserProfile?.activityTypeDislikes || [],
      environmentalSensitivities: currentUserProfile?.environmentalSensitivities || [],
      travelTolerance: currentUserProfile?.travelTolerance || '',
      budgetFlexibilityNotes: currentUserProfile?.budgetFlexibilityNotes || '',
      socialPreferences: {
        preferredGroupSize: currentUserProfile?.socialPreferences?.preferredGroupSize || null,
        interactionLevel: currentUserProfile?.socialPreferences?.interactionLevel || null,
      },
      availabilityNotes: currentUserProfile?.availabilityNotes || '',
    },
  });

  const selectedCountryCodeValue = form.watch('selectedCountryCode');
  const currentSelectedCountryData = countries.find((c: any) => c.code === selectedCountryCodeValue);

  const filteredCountries = countries.filter((country: any) =>
    !countrySearchTerm || 
    country.name.toLowerCase().includes(countrySearchTerm.toLowerCase()) ||
    country.code.toLowerCase().includes(countrySearchTerm.toLowerCase()) ||
    country.dialCode.includes(countrySearchTerm)
  );

  // Load current profile data into form
  useEffect(() => {
    if (currentUserProfile) {
      const { firstName: legacyFirst, lastName: legacyLast } = splitLegacyName(currentUserProfile.name);
      form.reset({
        firstName: currentUserProfile.firstName || legacyFirst || '',
        lastName: currentUserProfile.lastName || legacyLast || '',
        bio: currentUserProfile.bio || '',
        selectedCountryCode: countries.find((c: any) => c.dialCode === currentUserProfile.countryDialCode)?.code ||
                           countries.find((c: any) => c.code === currentUserProfile.countryDialCode)?.code || 
                           null,
        phoneNumber: currentUserProfile.phoneNumber || '',
        birthDate: currentUserProfile.birthDate && typeof currentUserProfile.birthDate !== 'string' && typeof (currentUserProfile.birthDate as any)?.toDate === 'function'
          ? (currentUserProfile.birthDate as any).toDate().toISOString().split('T')[0]
          : (typeof currentUserProfile.birthDate === 'string' ? currentUserProfile.birthDate.split('T')[0] : ''),
        physicalAddress: {
          street: currentUserProfile.physicalAddress?.street || '',
          city: currentUserProfile.physicalAddress?.city || '',
          state: currentUserProfile.physicalAddress?.state || '',
          zipCode: currentUserProfile.physicalAddress?.zipCode || '',
          country: currentUserProfile.physicalAddress?.country || '',
        },
        allergies: currentUserProfile.allergies || [],
        dietaryRestrictions: currentUserProfile.dietaryRestrictions || [],
        generalPreferences: currentUserProfile.generalPreferences || '',
        favoriteCuisines: currentUserProfile.favoriteCuisines || [],
        physicalLimitations: currentUserProfile.physicalLimitations || [],
        activityTypePreferences: currentUserProfile.activityTypePreferences || [],
        activityTypeDislikes: currentUserProfile.activityTypeDislikes || [],
        environmentalSensitivities: currentUserProfile.environmentalSensitivities || [],
        travelTolerance: currentUserProfile.travelTolerance || '',
        budgetFlexibilityNotes: currentUserProfile.budgetFlexibilityNotes || '',
        socialPreferences: {
          preferredGroupSize: currentUserProfile.socialPreferences?.preferredGroupSize || null,
          interactionLevel: currentUserProfile.socialPreferences?.interactionLevel || null,
        },
        availabilityNotes: currentUserProfile.availabilityNotes || '',
      });
    }
  }, [currentUserProfile]);

  const onSubmit = async (data: EditProfileFormValues) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const countryDialCode = data.selectedCountryCode
        ? countries.find((c: any) => c.code === data.selectedCountryCode)?.dialCode || null
        : null;
      const profileData = {
        firstName: data.firstName,
        lastName: data.lastName,
        // For legacy compatibility, combine first and last name
        name: [data.firstName, data.lastName].filter(Boolean).join(' '),
        bio: data.bio || '',
        countryDialCode,
        phoneNumber: data.phoneNumber || '',
        birthDate: data.birthDate || null,
        physicalAddress: data.physicalAddress || {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: '',
        },
        allergies: data.allergies || [],
        dietaryRestrictions: data.dietaryRestrictions || [],
        generalPreferences: data.generalPreferences || '',
        favoriteCuisines: data.favoriteCuisines || [],
        physicalLimitations: data.physicalLimitations || [],
        activityTypePreferences: data.activityTypePreferences || [],
        activityTypeDislikes: data.activityTypeDislikes || [],
        environmentalSensitivities: data.environmentalSensitivities || [],
        travelTolerance: data.travelTolerance || '',
        budgetFlexibilityNotes: data.budgetFlexibilityNotes || '',
        socialPreferences: {
          preferredGroupSize: data.socialPreferences?.preferredGroupSize || null,
          interactionLevel: data.socialPreferences?.interactionLevel || null,
        },
        availabilityNotes: data.availabilityNotes || '',
      };

      const result = await updateUserProfileAction(user.uid, profileData);

      if (result.success) {
        toast({
          title: "Profile Updated!",
          description: "Your profile has been successfully updated.",
        });
        await refreshProfileStatus();
        router.push(`/users/${user.uid}`);
      } else {
        toast({ 
          title: "Update Failed", 
          description: result.error || "An unknown error occurred.", 
          variant: "destructive" 
        });
      }
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast({ 
        title: "Error", 
        description: `Could not update profile: ${error.message}`, 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const userInitial = currentUserProfile?.name ? currentUserProfile.name.charAt(0).toUpperCase() : 
                     (user?.displayName ? user.displayName.charAt(0).toUpperCase() : 
                     (user?.email ? user.email.charAt(0).toUpperCase() : 'U'));

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 rounded-2xl blur-3xl" />
            <div className="relative bg-card/80 backdrop-blur-xl border border-border/40 rounded-2xl p-6 shadow-2xl ring-1 ring-border/20">
              <div className="flex items-center gap-6">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                  className="h-12 w-12 rounded-xl bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mb-2">
                    Edit Profile
                  </h1>
                  <p className="text-muted-foreground text-lg">Customize your profile and preferences to get better recommendations</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Accordion type="multiple" defaultValue={["profile-picture", "basic-info"]} className="space-y-6">
              {/* Profile Picture Section */}
              <AccordionItem value="profile-picture" className="border-none">
                <Card className="relative overflow-hidden bg-gradient-to-br from-card/90 via-card/95 to-card/90 backdrop-blur-xl border-border/30 shadow-2xl ring-1 ring-border/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
                  <CardHeader className="relative pb-2">
                    <AccordionTrigger className="hover:no-underline p-0 [&[data-state=open]>div>svg]:rotate-180">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        📸 Profile Picture
                      </CardTitle>
                    </AccordionTrigger>
                    <CardDescription className="text-base mt-2">
                      Your profile picture helps others recognize you
                    </CardDescription>
                  </CardHeader>
                  <AccordionContent className="pb-0">
                    <CardContent className="relative space-y-6">
                      <div className="flex items-center gap-6">
                        <Avatar className="h-24 w-24">
                          <AvatarImage src={currentUserProfile?.avatarUrl || user?.photoURL || ''} />
                          <AvatarFallback className="text-2xl">{userInitial}</AvatarFallback>
                        </Avatar>
                        <div className="space-y-2">
                          <Button variant="outline" size="sm" disabled>
                            <Camera className="h-4 w-4 mr-2" />
                            Change Photo
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Photo upload coming soon
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>

              {/* Basic Information */}
              <AccordionItem value="basic-info" className="border-none">
                <Card className="relative overflow-hidden bg-gradient-to-br from-card/90 via-card/95 to-card/90 backdrop-blur-xl border-border/30 shadow-2xl ring-1 ring-border/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
                  <CardHeader className="relative pb-2">
                    <AccordionTrigger className="hover:no-underline p-0 [&[data-state=open]>div>svg]:rotate-180">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        👤 Basic Information
                      </CardTitle>
                    </AccordionTrigger>
                    <CardDescription className="text-base mt-2">
                      Your name and bio that others will see on your profile
                    </CardDescription>
                  </CardHeader>
                  <AccordionContent className="pb-0">
                    <CardContent className="relative space-y-6">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>📝 First Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter your first name" 
                                {...field} 
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>📝 Last Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter your last name" 
                                {...field} 
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="bio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>✍️ Bio (Optional)</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Tell others a little about yourself..." 
                                {...field} 
                                value={field.value || ''}
                                className="min-h-[80px]" 
                                maxLength={160}
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              {(field.value || '').length}/160 characters
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>

              {/* Contact Information */}
              <AccordionItem value="contact" className="border-none">
                <Card className="relative overflow-hidden bg-gradient-to-br from-card/90 via-card/95 to-card/90 backdrop-blur-xl border-border/30 shadow-2xl ring-1 ring-border/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
                  <CardHeader className="relative">
                    <AccordionTrigger className="hover:no-underline">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm">
                          <Phone className="h-5 w-5 text-primary" />
                        </div>
                        📞 Contact Information
                      </CardTitle>
                    </AccordionTrigger>
                    <CardDescription className="text-base">
                      Your contact details and birth date
                    </CardDescription>
                  </CardHeader>
                  <AccordionContent className="pb-0">
                    <CardContent className="relative space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="selectedCountryCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>🌍 Country Code</FormLabel>
                        <Popover open={isCountryPickerOpen} onOpenChange={setIsCountryPickerOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={isCountryPickerOpen}
                                className={cn(
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                                disabled={isSubmitting}
                              >
                                {currentSelectedCountryData ? (
                                  <span className="flex items-center gap-2">
                                    {getCountryFlagEmoji(currentSelectedCountryData.code)}
                                    {currentSelectedCountryData.dialCode}
                                  </span>
                                ) : (
                                  "Select country..."
                                )}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0">
                            <Command>
                              <CommandInput
                                placeholder="Search country..."
                                value={countrySearchTerm}
                                onValueChange={setCountrySearchTerm}
                              />
                              <ScrollArea className="h-[200px]">
                                <CommandList>
                                  {filteredCountries.length === 0 && (
                                    <CommandEmpty>No country found.</CommandEmpty>
                                  )}
                                  <CommandGroup>
                                    {filteredCountries.map((country: any) => (
                                      <CommandItem
                                        key={country.code}
                                        value={country.code}
                                        onSelect={() => {
                                          form.setValue(
                                            "selectedCountryCode", 
                                            country.code === field.value ? null : country.code,
                                            { shouldValidate: true }
                                          );
                                          setIsCountryPickerOpen(false);
                                          setCountrySearchTerm('');
                                        }}
                                        className="flex items-center gap-2 cursor-pointer"
                                      >
                                        <span>{getCountryFlagEmoji(country.code)}</span>
                                        <span className="flex-1 truncate">
                                          {country.name} ({country.dialCode})
                                        </span>
                                        <Check
                                          className={cn(
                                            "ml-auto h-4 w-4",
                                            field.value === country.code ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </ScrollArea>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                        <div className="md:col-span-2">
                          <FormField
                            control={form.control}
                            name="phoneNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>📱 Phone Number</FormLabel>
                          <FormControl>
                            <Input 
                              type="tel" 
                              placeholder="555-123-4567" 
                              {...field} 
                              value={field.value || ''}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                      <FormField
                        control={form.control}
                        name="birthDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>🎂 Birth Date</FormLabel>
                            <FormControl>
                              <Input 
                                type="date" 
                                {...field} 
                                value={field.value || ''}
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>

              {/* Address Information */}
              <AccordionItem value="address" className="border-none">
                <Card className="relative overflow-hidden bg-gradient-to-br from-card/90 via-card/95 to-card/90 backdrop-blur-xl border-border/30 shadow-2xl ring-1 ring-border/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
                  <CardHeader className="relative">
                    <AccordionTrigger className="hover:no-underline">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm">
                          <MapPin className="h-5 w-5 text-primary" />
                        </div>
                        🏠 Address Information
                      </CardTitle>
                    </AccordionTrigger>
                    <CardDescription className="text-base">
                      Your physical address (optional)
                    </CardDescription>
                  </CardHeader>
                  <AccordionContent className="pb-0">
                    <CardContent className="relative space-y-6">
                      <FormField
                        control={form.control}
                        name="physicalAddress.street"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>🛣️ Street Address</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="123 Main Street" 
                                {...field} 
                                value={field.value || ''}
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="physicalAddress.city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>🏙️ City</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="City" 
                                  {...field} 
                                  value={field.value || ''}
                                  disabled={isSubmitting}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="physicalAddress.zipCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>📮 Zip/Postal Code</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="12345" 
                                  {...field} 
                                  value={field.value || ''}
                                  disabled={isSubmitting}
                                />
                              </FormControl>
                              <FormMessage />
                      </FormItem>
                    )}
                  />
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <FormField
                           control={form.control}
                           name="physicalAddress.state"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>🏛️ State/Province</FormLabel>
                               <FormControl>
                                 <Input 
                                   placeholder="State/Province" 
                                   {...field} 
                                   value={field.value || ''}
                                   disabled={isSubmitting}
                                 />
                               </FormControl>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                         
                         <FormField
                           control={form.control}
                           name="physicalAddress.country"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>🌎 Country</FormLabel>
                               <FormControl>
                                 <Input 
                                   placeholder="Country" 
                                   {...field} 
                                   value={field.value || ''}
                                   disabled={isSubmitting}
                                 />
                               </FormControl>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                       </div>
                     </CardContent>
                   </AccordionContent>
                 </Card>
               </AccordionItem>

              {/* Dietary Preferences & Allergies */}
              <AccordionItem value="dietary" className="border-none">
                <Card className="relative overflow-hidden bg-gradient-to-br from-card/90 via-card/95 to-card/90 backdrop-blur-xl border-border/30 shadow-2xl ring-1 ring-border/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
                  <CardHeader className="relative">
                    <AccordionTrigger className="hover:no-underline">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm">
                          <Utensils className="h-5 w-5 text-primary" />
                        </div>
                        🍽️ Dietary Preferences & Allergies
                      </CardTitle>
                    </AccordionTrigger>
                    <CardDescription className="text-base">
                      Help us recommend the best dining experiences for you
                    </CardDescription>
                  </CardHeader>
                  <AccordionContent className="pb-0">
                    <CardContent className="relative space-y-6">
                      <FormField
                        control={form.control}
                        name="allergies"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>🚨 Allergies</FormLabel>
                            <FormControl>
                              <MultiSelect
                                options={commonAllergies}
                                value={field.value || []}
                                onChange={field.onChange}
                                placeholder="Select your allergies"
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="dietaryRestrictions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>🥗 Dietary Restrictions</FormLabel>
                            <FormControl>
                              <MultiSelect
                                options={commonDietaryRestrictions}
                                value={field.value || []}
                                onChange={field.onChange}
                                placeholder="Select your dietary restrictions"
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="favoriteCuisines"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>🍜 Favorite Cuisines</FormLabel>
                            <FormControl>
                              <MultiSelect
                                options={commonFavoriteCuisines}
                                value={field.value || []}
                                onChange={field.onChange}
                                placeholder="Select your favorite cuisines"
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>

              {/* Activity Preferences */}
              <AccordionItem value="activity" className="border-none">
                <Card className="relative overflow-hidden bg-gradient-to-br from-card/90 via-card/95 to-card/90 backdrop-blur-xl border-border/30 shadow-2xl ring-1 ring-border/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
                  <CardHeader className="relative">
                    <AccordionTrigger className="hover:no-underline">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm">
                          <Activity className="h-5 w-5 text-primary" />
                        </div>
                        🏃 Activity Preferences
                      </CardTitle>
                    </AccordionTrigger>
                    <CardDescription className="text-base">
                      Tell us what activities you love and what you'd rather avoid
                    </CardDescription>
                  </CardHeader>
                  <AccordionContent className="pb-0">
                    <CardContent className="relative space-y-6">
                      <FormField
                        control={form.control}
                        name="activityTypePreferences"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>✅ Activities You Enjoy</FormLabel>
                            <FormControl>
                              <MultiSelect
                                options={commonActivityTypes}
                                value={field.value || []}
                                onChange={field.onChange}
                                placeholder="Select activities you enjoy"
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="activityTypeDislikes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>❌ Activities You'd Rather Avoid</FormLabel>
                            <FormControl>
                              <MultiSelect
                                options={commonActivityTypes}
                                value={field.value || []}
                                onChange={field.onChange}
                                placeholder="Select activities you'd rather avoid"
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="generalPreferences"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>💭 General Preferences</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Tell us about your general likes, dislikes, and preferences..."
                                {...field}
                                value={field.value || ''}
                                className="min-h-[100px]"
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>

              {/* Accessibility & Comfort */}
              <AccordionItem value="accessibility" className="border-none">
                <Card className="relative overflow-hidden bg-gradient-to-br from-card/90 via-card/95 to-card/90 backdrop-blur-xl border-border/30 shadow-2xl ring-1 ring-border/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
                  <CardHeader className="relative">
                    <AccordionTrigger className="hover:no-underline">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm">
                          <Heart className="h-5 w-5 text-primary" />
                        </div>
                        ♿ Accessibility & Comfort
                      </CardTitle>
                    </AccordionTrigger>
                    <CardDescription className="text-base">
                      Help us ensure activities are comfortable and accessible for you
                    </CardDescription>
                  </CardHeader>
                  <AccordionContent>
                    <CardContent className="relative space-y-6">
                      <FormField
                        control={form.control}
                        name="physicalLimitations"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>🦴 Physical Considerations</FormLabel>
                            <FormControl>
                              <MultiSelect
                                options={commonPhysicalLimitations}
                                value={field.value || []}
                                onChange={field.onChange}
                                placeholder="Select any physical considerations"
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="environmentalSensitivities"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>🌿 Environmental Sensitivities</FormLabel>
                            <FormControl>
                              <MultiSelect
                                options={commonEnvironmentalSensitivities}
                                value={field.value || []}
                                onChange={field.onChange}
                                placeholder="Select any environmental sensitivities"
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>

              {/* Social & Travel Preferences */}
              <AccordionItem value="social" className="border-none">
                <Card className="relative overflow-hidden bg-gradient-to-br from-card/90 via-card/95 to-card/90 backdrop-blur-xl border-border/30 shadow-2xl ring-1 ring-border/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
                  <CardHeader className="relative">
                    <AccordionTrigger className="hover:no-underline">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        👥 Social & Travel Preferences
                      </CardTitle>
                    </AccordionTrigger>
                    <CardDescription className="text-base">
                      Tell us about your social style and travel preferences
                    </CardDescription>
                  </CardHeader>
                  <AccordionContent>
                    <CardContent className="relative space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="socialPreferences.preferredGroupSize"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>👥 Preferred Group Size</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ''} disabled={isSubmitting}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select group size preference" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {preferredGroupSizeOptions.map(option => (
                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="socialPreferences.interactionLevel"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>🗣️ Social Interaction Level</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ''} disabled={isSubmitting}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select interaction level" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {interactionLevelOptions.map(option => (
                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="travelTolerance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>🚗 Travel Distance Preference</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''} disabled={isSubmitting}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="How far are you willing to travel?" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {travelToleranceOptions.map(option => (
                                  <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="budgetFlexibilityNotes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>💰 Budget Preferences</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Tell us about your budget preferences and spending style..."
                                {...field}
                                value={field.value || ''}
                                className="min-h-[80px]"
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>

              {/* Availability */}
              <AccordionItem value="availability" className="border-none">
                <Card className="relative overflow-hidden bg-gradient-to-br from-card/90 via-card/95 to-card/90 backdrop-blur-xl border-border/30 shadow-2xl ring-1 ring-border/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
                  <CardHeader className="relative">
                    <AccordionTrigger className="hover:no-underline">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm">
                          <Clock className="h-5 w-5 text-primary" />
                        </div>
                        📅 Availability
                      </CardTitle>
                    </AccordionTrigger>
                    <CardDescription className="text-base">
                      Let others know about your general availability
                    </CardDescription>
                  </CardHeader>
                  <AccordionContent>
                    <CardContent className="relative">
                      <FormField
                        control={form.control}
                        name="availabilityNotes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>📝 Availability Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Share your general availability, preferred times, or any scheduling notes..."
                                {...field}
                                value={field.value || ''}
                                className="min-h-[100px]"
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            </Accordion>

            {/* Action Buttons */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 rounded-2xl blur-2xl" />
              <Card className="relative bg-gradient-to-br from-card/90 via-card/95 to-card/90 backdrop-blur-xl border-border/30 shadow-2xl ring-1 ring-border/20">
                <CardContent className="p-8">
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.back()}
                      disabled={isSubmitting}
                      className="w-full sm:w-auto min-w-[140px] h-12 text-base bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto min-w-[160px] h-12 text-base bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg transition-all duration-300"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Saving Changes...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-5 w-5" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}