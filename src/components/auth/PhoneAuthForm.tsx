'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowPathIcon, ArrowsUpDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useRouter } from 'next/navigation';
import { AuthHeader } from './shared/AuthComponents';
import { handleRedirect } from './shared/AuthUtils';
import type { ConfirmationResult } from 'firebase/auth';
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { countries } from '@/app/(app)/onboarding/countries';
import { getCountryFlagEmoji } from '@/lib/country-utils';

const phoneFormSchema = z.object({
  countryCode: z.string().min(1, { message: 'Please select a country code.' }),
  phoneNumber: z.string()
    .min(1, { message: 'Please enter a phone number.' })
    .max(15, { message: 'Phone number cannot exceed 15 digits.' })
    .regex(/^\d+$/, { message: 'Please enter only digits for the phone number.' }),
});

const codeFormSchema = z.object({
  verificationCode: z.string()
    .length(6, { message: 'Verification code must be 6 digits.' })
    .regex(/^\d{6}$/, { message: 'Please enter a 6-digit verification code.' }),
});

type PhoneFormValues = z.infer<typeof phoneFormSchema>;
type CodeFormValues = z.infer<typeof codeFormSchema>;

export function PhoneAuthForm() {
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isCountryPickerOpen, setIsCountryPickerOpen] = useState(false);
  const [countrySearchTerm, setCountrySearchTerm] = useState('');

  const { toast } = useToast();
  const { signInWithPhone, confirmPhoneCode } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();
  
  const siteName = settings?.siteName || 'Macaroom';

  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneFormSchema),
    defaultValues: {
      countryCode: 'US', // Default to US
      phoneNumber: '',
    },
  });

  const codeForm = useForm<CodeFormValues>({
    resolver: zodResolver(codeFormSchema),
    defaultValues: {
      verificationCode: '',
    },
    mode: 'onChange',
  });

  // Reset code form when switching to code form
  useEffect(() => {
    if (showCodeForm) {
      codeForm.reset();
    }
  }, [showCodeForm, codeForm]);

  // Cooldown timer effect
  useEffect(() => {
    if (cooldownTime > 0) {
      const timer = setTimeout(() => {
        setCooldownTime(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (cooldownTime === 0 && lastError) {
      // Clear error message when cooldown expires
      setLastError(null);
    }
  }, [cooldownTime, lastError]);

  const selectedCountryCodeValue = phoneForm.watch('countryCode');
  const currentSelectedCountryData = countries.find((c: any) => c.code === selectedCountryCodeValue);

  const filteredCountries = countries.filter((country: any) =>
    !countrySearchTerm || 
    country.name.toLowerCase().includes(countrySearchTerm.toLowerCase()) ||
    country.code.toLowerCase().includes(countrySearchTerm.toLowerCase()) ||
    country.dialCode.includes(countrySearchTerm)
  );

  const handleSendCode = async (data: PhoneFormValues) => {
    if (cooldownTime > 0) {
      toast({
        title: 'Please Wait',
        description: `Please wait ${cooldownTime} seconds before trying again.`,
        variant: 'destructive',
      });
      return;
    }

    setIsSendingCode(true);
    setLastError(null);
    
    try {
      // Combine country code and phone number
      const fullPhoneNumber = `${currentSelectedCountryData?.dialCode}${data.phoneNumber}`;
      const result = await signInWithPhone(fullPhoneNumber);
      setConfirmationResult(result);
      setPhoneNumber(fullPhoneNumber);
      setShowCodeForm(true);
      phoneForm.reset();
      codeForm.reset();
      toast({
        title: 'Verification Code Sent',
        description: 'A 6-digit verification code has been sent to your phone number.',
      });
    } catch (error: any) {
      console.error('Phone Sign-In error:', error);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      let cooldown = 0;
      
      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Please enter a valid phone number with country code.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please wait a few minutes before trying again.';
        cooldown = 120; // 2 minute cooldown (estimate - Firebase doesn't document exact limits)
      } else if (error.code === 'auth/quota-exceeded') {
        errorMessage = 'SMS quota exceeded. Please try again later.';
        cooldown = 300; // 5 minute cooldown (estimate - Firebase doesn't document exact limits)
      } else if (error.code === 'auth/invalid-app-credential') {
        errorMessage = 'reCAPTCHA verification failed. Please refresh the page and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setLastError(errorMessage);
      setCooldownTime(cooldown);
      
      toast({
        title: 'Failed to Send Code',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async (data: CodeFormValues) => {
    if (!confirmationResult) {
      toast({
        title: 'Error',
        description: 'No verification session found. Please try sending the code again.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPhoneCode(confirmationResult, data.verificationCode);
      if (!handleRedirect(router)) {
        // AuthContext handles default redirect
      }
    } catch (error: any) {
      console.error('Code verification error:', error);
      let errorMessage = 'Invalid verification code. Please try again.';
      
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid verification code. Please check the code and try again.';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'Verification code has expired. Please request a new code.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Verification Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToPhone = () => {
    setShowCodeForm(false);
    setConfirmationResult(null);
    setPhoneNumber('');
    codeForm.reset();
  };

  return (
    <div className="space-y-4">
      {showCodeForm ? (
        <Form {...codeForm} key="code-form">
          <form onSubmit={codeForm.handleSubmit(handleVerifyCode)} className="space-y-3">
            <FormField
              control={codeForm.control}
              name="verificationCode"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormControl>
                    <Input 
                      type="text" 
                      placeholder="123456" 
                      {...field} 
                      maxLength={6}
                      autoComplete="one-time-code"
                      className="h-10 text-center text-lg tracking-widest"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full h-10 mt-4 bg-orange-500 hover:bg-orange-600 text-white font-medium" 
              disabled={isSubmitting || isSendingCode}
            >
              {isSubmitting && <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />}
              Verify Code
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...phoneForm} key="phone-form">
          <form onSubmit={phoneForm.handleSubmit(handleSendCode)} className="space-y-4">
            <div className="flex gap-3">
              <FormField
                control={phoneForm.control}
                name="countryCode"
                render={({ field }) => (
                  <FormItem className="space-y-2 flex-shrink-0">
                    <Popover open={isCountryPickerOpen} onOpenChange={setIsCountryPickerOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={isCountryPickerOpen}
                            className={cn(
                              "w-[100px] justify-between h-10 px-2",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {currentSelectedCountryData ? (
                              <span className="flex items-center gap-1">
                                <span className="text-sm">{getCountryFlagEmoji(currentSelectedCountryData.code)}</span>
                                <span className="text-sm font-medium">{currentSelectedCountryData.dialCode}</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <span className="text-sm">🌍</span>
                                <span className="text-sm">+1</span>
                              </span>
                            )}
                            <ArrowsUpDownIcon className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0">
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
                                      phoneForm.setValue(
                                        "countryCode", 
                                        country.code === field.value ? null : country.code,
                                        { shouldValidate: true }
                                      );
                                      setIsCountryPickerOpen(false);
                                      setCountrySearchTerm('');
                                    }}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <span className="text-base">{getCountryFlagEmoji(country.code)}</span>
                                    <span className="flex-1 truncate">
                                      {country.name} ({country.dialCode})
                                    </span>
                                    <CheckIcon
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
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <FormField
                control={phoneForm.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem className="space-y-2 flex-1">
                    <FormControl>
                      <Input 
                        type="tel" 
                        placeholder="555-123-4567" 
                        {...field} 
                        autoComplete="tel"
                        className="h-10"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-10 mt-4 bg-orange-500 hover:bg-orange-600 text-white font-medium" 
              disabled={isSendingCode || isSubmitting || cooldownTime > 0}
            >
              {isSendingCode && <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />}
              {cooldownTime > 0 
                ? cooldownTime > 60 
                  ? `Wait ${Math.floor(cooldownTime / 60)}m ${cooldownTime % 60}s` 
                  : `Wait ${cooldownTime}s`
                : 'Send Verification Code'
              }
            </Button>
            {cooldownTime > 0 && (
              <div className="space-y-2">
                <Progress 
                  value={cooldownTime <= 120 ? ((120 - cooldownTime) / 120) * 100 : ((300 - cooldownTime) / 300) * 100} 
                  className="h-1"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Rate limit active - please wait
                </p>
              </div>
            )}
            {lastError && (
              <p className="text-xs text-red-500 mt-2 text-center">
                {lastError}
              </p>
            )}
          </form>
        </Form>
      )}
    </div>
  );
} 