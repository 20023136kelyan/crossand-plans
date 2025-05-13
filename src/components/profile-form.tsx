"use client";

import type { UserProfile } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
// import type { z } from "zod"; // No longer directly needed for z.infer here
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { updateUserProfile } from "@/lib/actions/user";
import { profileSchema, type ProfileSchemaInput, type ProfileSchemaOutput } from "@/lib/schemas";
import { MOCK_USER_ID } from "@/types"; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect, useRef } from "react";
import { Loader2, Fingerprint, CalendarIcon as CalendarIconLucide, Home, Phone, Utensils, Accessibility, ThumbsUp, ThumbsDown, Wind, MapPinned, WalletCards, UsersRound, Palette, ImageUp } from "lucide-react";
import { AllergiesInput } from "./allergies-input";
import { DietaryRestrictionsInput } from "./dietary-restrictions-input";
import { FavoriteCuisinesInput } from "./favorite-cuisines-input";
import { PhysicalLimitationsInput } from "./physical-limitations-input";
import { ActivityTypePreferencesInput } from "./activity-type-preferences-input";
import { ActivityTypeDislikesInput } from "./activity-type-dislikes-input";
import { EnvironmentalSensitivitiesInput } from "./environmental-sensitivities-input";
import { SocialPreferencesInput } from "./social-preferences-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Separator } from "./ui/separator";
import { CountrySelect } from "./country-select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageCropperDialog } from "./image-cropper-dialog";

// Use ProfileSchemaInput for form values
type ProfileFormInputValues = ProfileSchemaInput;

interface ProfileFormProps {
  profile: UserProfile | null;
  onSaveSuccess?: (updatedProfile: UserProfile) => void;
  onCancel?: () => void;
}

declare global {
  interface Window {
    google: typeof google;
    initMapGlobally?: () => void; 
  }
}

function mapUserProfileToFormInput(p: UserProfile | null): ProfileFormInputValues {
  return {
    // The 'id' field in the form should be the profile's current display/editable ID.
    // If profile is null (e.g. new user creation, not applicable here but good practice),
    // it might default to MOCK_USER_ID or be empty depending on context.
    // For editing existing profile, it's `p.id`.
    id: p?.id || MOCK_USER_ID, // This sets the initial value of the ID field in the form.
    firstName: p?.firstName || "",
    lastName: p?.lastName || "",
    email: p?.email || "",
    phoneNumber: p?.phoneNumber || "",
    birthDate: p?.birthDate || null,
    address: p?.address || { street: "", city: "", state: "", zipCode: "", country: "" },
    avatarUrl: p?.avatarUrl || null,
    allergies: p?.allergies || [],
    dietaryRestrictions: p?.dietaryRestrictions || [],
    favoriteCuisines: p?.favoriteCuisines || [],
    preferences: p?.preferences?.join(", ") || "", // Convert array to string for form
    availability: p?.availability || "",
    physicalLimitations: p?.physicalLimitations || [],
    activityTypePreferences: p?.activityTypePreferences || [],
    activityTypeDislikes: p?.activityTypeDislikes || [],
    environmentalSensitivities: p?.environmentalSensitivities || [],
    travelTolerance: p?.travelTolerance || "",
    budgetFlexibilityNotes: p?.budgetFlexibilityNotes || "",
    socialPreferences: p?.socialPreferences || [],
  };
}


export function ProfileForm({ profile, onSaveSuccess, onCancel }: ProfileFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const placeAutocompleteRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streetInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null | undefined>(profile?.avatarUrl);

  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);


  useEffect(() => {
    setIsClient(true);
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      setApiKeyMissing(true);
      console.warn("Google Maps API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) is missing. Address autocomplete will be limited or non-functional.");
    }
  }, []);

  useEffect(() => {
    setAvatarPreview(profile?.avatarUrl);
  }, [profile?.avatarUrl]);

  const form = useForm<ProfileFormInputValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: mapUserProfileToFormInput(profile),
    mode: "onChange",
  });

  useEffect(() => {
    // Reset form if profile prop changes
    form.reset(mapUserProfileToFormInput(profile));
    setAvatarPreview(profile?.avatarUrl);
  }, [profile, form]);


  useEffect(() => {
    if (!isClient || apiKeyMissing || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      return;
    }

    const fillInAddress = (place: google.maps.places.Place) => {
      if (!place.address_components) return;

      const addressValues: Partial<ProfileFormInputValues['address']> = {
        street: "", city: "", state: "", zipCode: "", country: ""
      };

      let streetNumber = "";
      let route = "";

      for (const component of place.address_components) {
        const componentType = component.types[0];
        switch (componentType) {
          case "street_number":
            streetNumber = component.long_name;
            break;
          case "route":
            route = component.short_name;
            break;
          case "locality":
            addressValues.city = component.long_name;
            break;
          case "administrative_area_level_1":
            addressValues.state = component.long_name;
            break;
          case "postal_code":
            addressValues.zipCode = component.long_name;
            break;
          case "country":
            addressValues.country = component.long_name;
            break;
        }
      }
      addressValues.street = `${streetNumber} ${route}`.trim();
      form.setValue("address.street", addressValues.street || "", { shouldValidate: true, shouldDirty: true });
      form.setValue("address.city", addressValues.city || "", { shouldValidate: true, shouldDirty: true });
      form.setValue("address.state", addressValues.state || "", { shouldValidate: true, shouldDirty: true });
      form.setValue("address.zipCode", addressValues.zipCode || "", { shouldValidate: true, shouldDirty: true });
      form.setValue("address.country", addressValues.country || "", { shouldValidate: true, shouldDirty: true });
    };

    const initializeAutocomplete = () => {
        if (placeAutocompleteRef.current) return;

        if (!window.google || !window.google.maps || !window.google.maps.places) {
            console.error("Google Maps Places library not loaded. `initMapGlobally` should handle this.");
            return;
        }

        placeAutocompleteRef.current = new window.google.maps.places.PlaceAutocompleteElement();
        placeAutocompleteRef.current.setAttribute('types', 'address');
        placeAutocompleteRef.current.addEventListener('gmp-placeselect', (event: any) => {
            const place = event.detail.place;
            if (place) {
              fillInAddress(place.address_components);
            }
        });
    };
    
    window.initMapGlobally = initializeAutocomplete;

    // Attempt to initialize immediately if API is already available
    if (window.google && window.google.maps && window.google.maps.places) {
      initializeAutocomplete();
    } else if (!document.getElementById('google-maps-script')) {
      // Otherwise, load the script with the callback
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&callback=initMapGlobally&loading=async`;
      script.async = true;
      document.head.appendChild(script);
    }

    // Append the custom element once the component mounts and is client-side
    if (isClient) {
      const addressField = document.getElementById('address-street-field');
      if (addressField && placeAutocompleteRef.current) {
          addressField.appendChild(placeAutocompleteRef.current);
      }
    }

    return () => {
      if (window.initMapGlobally === initializeAutocomplete) {
        delete window.initMapGlobally;
      }
       if (autocompleteRef.current && window.google && window.google.maps && window.google.maps.event) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, apiKeyMissing, form.setValue]);


  async function onSubmit(data: ProfileFormInputValues) { 
    setIsSubmitting(true);
    try {
      const validationResult = profileSchema.safeParse(data);

      if (!validationResult.success) {
        const errorDetails = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        toast({
          title: "Validation Failed",
          description: `Please check your input. Errors: ${errorDetails}`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const transformedData: ProfileSchemaOutput = validationResult.data; 

      // Pass MOCK_USER_ID as the database key to update.
      // transformedData contains the new display ID in its `id` field.
      const result = await updateUserProfile(MOCK_USER_ID, transformedData); 
      
      if (result.success && result.data) {
        toast({
          title: "Profile Updated",
          description: result.message || "Your profile has been successfully updated.",
        });
        
        const actualResultData: UserProfile = result.data; 

        form.reset(mapUserProfileToFormInput(actualResultData)); 
        setAvatarPreview(actualResultData.avatarUrl);
        
        if (onSaveSuccess) {
          onSaveSuccess(actualResultData);
        }

      } else {
        toast({
          title: "Update Failed",
          description: result.message || "Could not update profile.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleAvatarFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
        setIsCropperOpen(true);
      };
      reader.readAsDataURL(file);
      if (event.target) {
        event.target.value = ""; // Reset file input
      }
    }
  };

  const handleCropConfirm = (croppedImageDataUri: string) => {
    setAvatarPreview(croppedImageDataUri);
    form.setValue("avatarUrl", croppedImageDataUri, { shouldValidate: true, shouldDirty: true });
    setIsCropperOpen(false);
    setImageToCrop(null);
  };

  const handleCropCancel = () => {
    setIsCropperOpen(false);
    setImageToCrop(null);
  };


  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle>Edit Your Profile</CardTitle>
        <CardDescription>Keep your information up to date for better planning.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="avatarUrl"
              render={({ field }) => (
                <FormItem className="flex flex-col items-center space-y-3">
                  <FormLabel htmlFor="avatar-upload" className="cursor-pointer">
                    <Avatar className="w-24 h-24 ring-2 ring-primary ring-offset-2 ring-offset-background">
                      <AvatarImage src={avatarPreview || undefined} alt={`${form.getValues("firstName")} ${form.getValues("lastName")}`} />
                      <AvatarFallback>{`${form.getValues("firstName")?.charAt(0) ?? ''}${form.getValues("lastName")?.charAt(0) ?? ''}`.toUpperCase() || <ImageUp />}</AvatarFallback>
                    </Avatar>
                  </FormLabel>
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <ImageUp className="mr-2 h-4 w-4" /> Change Photo
                  </Button>
                  <FormControl>
                    <Input 
                      id="avatar-upload"
                      type="file" 
                      accept="image/*" 
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleAvatarFileSelect} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isCropperOpen && imageToCrop && (
              <ImageCropperDialog
                imageSrc={imageToCrop}
                open={isCropperOpen}
                onOpenChange={setIsCropperOpen}
                onCropConfirm={handleCropConfirm}
                aspect={1} // For square avatar
              />
            )}


            <FormField
              control={form.control}
              name="id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <Fingerprint className="h-4 w-4 text-muted-foreground"/> User ID (Display ID)
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your desired User ID" {...field} />
                  </FormControl>
                  <FormDescription>
                    You can change your display User ID. Ensure it&apos;s unique among users.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your first name" {...field} />
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
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your last name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="your.email@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                     <Phone className="h-4 w-4 text-muted-foreground" /> Phone Number (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="e.g., +1 555-123-4567" {...field} />
                  </FormControl>
                  <FormDescription>
                    Used for reminders and friend discovery.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="birthDate"
              render={({ field }) => {
                const selectedDate = field.value && isClient ? new Date(field.value) : null;
                return (
                  <FormItem>
                    <FormLabel>Birth Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            disabled={!isClient}
                          >
                            {selectedDate ? (
                              format(selectedDate, "PPP")
                            ) : (
                              <span>{isClient ? "Pick a date" : "Loading..."}</span>
                            )}
                            <CalendarIconLucide className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate || undefined}
                          onSelect={(date) => {
                            field.onChange(date ? date.toISOString() : null);
                          }}
                          captionLayout="dropdown-buttons"
                          fromYear={1900}
                          toYear={new Date().getFullYear()}
                          disabled={!isClient}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      Your age will be calculated and may be used for event suggestions.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <Separator />
            <h3 className="text-lg font-medium flex items-center gap-2"><Home className="h-5 w-5 text-primary" /> Address</h3>
            <FormField
              control={form.control}
              name="address.street"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="address-street-field">Street</FormLabel>
                  <FormControl>
                    <div>
                      {/* The PlaceAutocompleteElement will be inserted here */}
                      <div id="address-street-field"></div>
                      <Input 
                        {...field}
                        placeholder="e.g., 123 Main St" 
                        ref={streetInputRef} 
                        disabled={!isClient} 
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    {isClient && !apiKeyMissing && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? "Start typing for address suggestions or fill manually." : "Enter address manually. Autocomplete disabled (API key may be missing)."}
                  </FormDescription>
                  {apiKeyMissing && isClient && (
                    <p className="text-sm text-destructive font-medium">
                      Google Maps Autocomplete is disabled because the API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) is missing. Please configure it in your environment variables and restart the server. You can still enter the address manually.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="address.city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Anytown" {...field} disabled={!isClient} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State / Province (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., CA" {...field} disabled={!isClient} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="address.zipCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zip / Postal Code (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 90210" {...field} disabled={!isClient} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                       <CountrySelect 
                          value={field.value || ""} 
                          onChange={(countryCodeOrName) => field.onChange(countryCodeOrName)} 
                          disabled={!isClient}
                       />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Separator />
             <h3 className="text-lg font-medium flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /> Preferences & Needs</h3>
            
            <FormField
              control={form.control}
              name="allergies"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allergies</FormLabel>
                  <FormControl>
                    <AllergiesInput
                      value={field.value}
                      onChange={field.onChange}
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
                  <FormLabel>Dietary Restrictions</FormLabel>
                  <FormControl>
                    <DietaryRestrictionsInput 
                      value={field.value}
                      onChange={field.onChange}
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
                  <FormLabel className="flex items-center gap-1">
                     <Utensils className="h-4 w-4 text-muted-foreground" /> Favorite Cuisines
                  </FormLabel>
                  <FormControl>
                    <FavoriteCuisinesInput
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="preferences"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>General Activity Preferences (Comma-separated)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Love hiking, Enjoy board games, Prefer quiet cafes" {...field} />
                  </FormControl>
                  <FormDescription>
                    Describe your general activity preferences, separated by commas.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Separator />
            <h3 className="text-lg font-medium flex items-center gap-2"><Accessibility className="h-5 w-5 text-primary" /> Accessibility & Activity</h3>
             <FormField
              control={form.control}
              name="physicalLimitations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><Accessibility className="h-4 w-4 text-muted-foreground"/> Physical Limitations / Accessibility Needs</FormLabel>
                  <FormControl>
                    <PhysicalLimitationsInput value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="activityTypePreferences"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><ThumbsUp className="h-4 w-4 text-muted-foreground"/> Preferred Activity Types</FormLabel>
                  <FormControl>
                    <ActivityTypePreferencesInput value={field.value} onChange={field.onChange} />
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
                  <FormLabel className="flex items-center gap-1"><ThumbsDown className="h-4 w-4 text-muted-foreground"/> Disliked Activity Types</FormLabel>
                  <FormControl>
                    <ActivityTypeDislikesInput value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Separator />
            <h3 className="text-lg font-medium flex items-center gap-2"><Wind className="h-5 w-5 text-primary" /> Environment & Social</h3>
             <FormField
              control={form.control}
              name="environmentalSensitivities"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><Wind className="h-4 w-4 text-muted-foreground"/> Environmental Sensitivities</FormLabel>
                  <FormControl>
                    <EnvironmentalSensitivitiesInput value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="socialPreferences"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><UsersRound className="h-4 w-4 text-muted-foreground"/> Social Preferences</FormLabel>
                  <FormControl>
                    <SocialPreferencesInput value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Separator />
            <h3 className="text-lg font-medium flex items-center gap-2"><MapPinned className="h-5 w-5 text-primary" /> Logistics & Other</h3>
            <FormField
              control={form.control}
              name="travelTolerance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><MapPinned className="h-4 w-4 text-muted-foreground"/> Travel Tolerance (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Local only, Up to 1 hour, Flexible" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="budgetFlexibilityNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><WalletCards className="h-4 w-4 text-muted-foreground"/> Budget Flexibility Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Prefer free events, Willing to splurge for special occasions" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="availability"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>General Availability</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Weekends, Weekday evenings after 6 PM" {...field} />
                  </FormControl>
                  <FormDescription>
                    Briefly describe your general availability.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col sm:flex-row-reverse gap-3 pt-4">
                <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting || !isClient}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
                {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="w-full sm:w-auto">
                    Cancel
                </Button>
                )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

