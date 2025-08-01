
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff, Shield, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { EmailVerificationPrompt } from './EmailVerificationPrompt';
import { sendEmailVerification } from 'firebase/auth';

const CrossandLogo = ({ className }: { className?: string }) => (
  <img src="/images/crossand-logo.svg" alt="Crossand Logo" className={className} />
);

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" width="18" height="18" className="mr-2">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.53-4.18 7.09-10.36 7.09-17.65z"></path>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
    <path fill="none" d="M0 0h48v48H0z"></path>
  </svg>
);

const signupFormSchema = z.object({
  fullName: z.string()
    .min(2, { message: 'Full name must be at least 2 characters.' })
    .max(50, { message: 'Full name cannot exceed 50 characters.' })
    .regex(/^[a-zA-Z\s'-]+$/, { message: 'Full name can only contain letters, spaces, hyphens, and apostrophes.' }),
  username: z.string()
    .min(3, { message: 'Username must be at least 3 characters.' })
    .max(20, { message: 'Username cannot exceed 20 characters.' })
    .regex(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores.' })
    .regex(/^[a-zA-Z]/, { message: 'Username must start with a letter.' }),
  email: z.string()
    .email({ message: 'Please enter a valid email address.' })
    .max(254, { message: 'Email address is too long.' })
    .refine(email => !email.includes('..'), { message: 'Email cannot contain consecutive dots.' }),
  password: z.string()
    .min(8, { message: 'Password must be at least 8 characters.' })
    .max(128, { message: 'Password cannot exceed 128 characters.' })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&).'
    }),
  confirmPassword: z.string(),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to the terms and conditions.'
  })
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

type SignupFormValues = z.infer<typeof signupFormSchema>;

export function SignupForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const { toast } = useToast();
  const { signUpWithEmail, signInWithGoogle, acknowledgeNewUserWelcome } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();
  const searchParamsHook = useSearchParams();
  
  const siteName = settings?.siteName || 'Macaroom';

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      fullName: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      agreeToTerms: false,
    },
  });

  // Debug form state changes
  React.useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      console.log('Form values:', value);
      console.log('Form errors:', form.formState.errors);
      console.log('Is form valid?', form.formState.isValid);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Password strength calculation
  const calculatePasswordStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[@$!%*?&]/.test(password)) score += 1;
    return score;
  };

  const getPasswordStrengthLabel = (score: number) => {
    if (score === 0) return { label: '', color: '' };
    if (score <= 2) return { label: 'Weak', color: 'text-red-500' };
    if (score <= 3) return { label: 'Fair', color: 'text-yellow-500' };
    if (score <= 4) return { label: 'Good', color: 'text-blue-500' };
    return { label: 'Strong', color: 'text-green-500' };
  };

  const passwordValue = form.watch('password');
  const passwordStrength = calculatePasswordStrength(passwordValue);
  const strengthInfo = getPasswordStrengthLabel(passwordStrength);

  const handleGoogleSignUp = async () => {
    setIsGoogleSubmitting(true);
    try {
      await signInWithGoogle(); // signInWithGoogle handles both sign-in and sign-up (linking)
      const searchParams = new URLSearchParams(window.location.search);
      const redirectPath = searchParams.get('redirect');
      searchParams.delete('redirect');
      
      if (redirectPath) {
        const finalRedirect = redirectPath + (searchParams.toString() ? `?${searchParams.toString()}` : '');
        router.push(finalRedirect);
        return;
      }
      // AuthContext will handle default redirect
    } catch (error: any) {
      console.error('Signup Form: Google Sign-Up error:', error.code, error.message, error);
      let description = 'An unexpected error occurred. Please try again.';
      if (error.code === 'auth/popup-closed-by-user') {
        description = 'Google Sign-Up was cancelled. This can happen if popups are blocked or if this website is not an "Authorized JavaScript origin" in your Google Cloud Console OAuth settings for this Firebase project. Please check your browser settings and OAuth configuration, then try again.';
      } else if (error.code === 'auth/unauthorized-domain') {
        description = 'This website domain is not authorized for Google Sign-Up. Please check your Firebase project settings.';
      } else if (error.message) {
        description = error.message;
      }
      toast({
        title: 'Sign-Up Failed',
        description: description,
        variant: 'destructive',
      });
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const onEmailSubmit = async (data: SignupFormValues) => {
    setIsSubmitting(true);
    try {
      console.log('[SignupForm] Starting signup process...');
      const user = await signUpWithEmail(data.email, data.password, data.fullName, data.username);
      
      if (user) {
        console.log('[SignupForm] User created successfully, sending email verification...');
        // Send email verification
        try {
          // Configure verification email with redirect to onboarding
          const actionCodeSettings = {
            url: `${window.location.origin}/onboarding`,
            handleCodeInApp: true
          };
          await sendEmailVerification(user, actionCodeSettings);
          console.log('[SignupForm] Email verification sent successfully');
          // Instead of setting local state, redirect to verification page
          router.push(`/signup?verify=1&email=${encodeURIComponent(data.email)}`);
          return;
        } catch (verificationError) {
          console.error('[SignupForm] Email verification error:', verificationError);
          // Still show success but mention verification issue
          toast({
            title: 'Account Created',
            description: 'Account created but verification email failed to send. You can resend it from your profile.',
            variant: 'default',
          });
          router.push(`/signup?verify=1&email=${encodeURIComponent(data.email)}`);
          return;
        }
      } else {
        console.log('[SignupForm] User creation returned null/undefined');
      }
    } catch (error: any) {
      console.error('Email Sign-Up error:', error);
      let errorMessage = 'An unexpected error occurred.';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists. Please try logging in instead.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Sign-Up Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show email verification prompt after successful signup
  // (No longer needed, handled by redirect)
  // if (showEmailVerification) {
  //   return (
  //     <EmailVerificationPrompt 
  //       email={userEmail} 
  //       onVerified={handleEmailVerified}
  //     />
  //   );
  // }

  return (
    <Card className="w-full shadow-lg bg-gray-900/30 backdrop-blur-md border-gray-700/40 overflow-hidden rounded-2xl">
      <CardHeader className="text-center space-y-3 pb-4">
        <div className="flex flex-col items-center">
          <Link href="/" className="flex items-center gap-2 mb-2">
            <CrossandLogo className="h-8 w-8" />
            <span className="text-2xl font-bold text-gradient-primary font-redressed">Crossand</span>
          </Link>
        </div>
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold text-foreground">Let's Get Started</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Join our community to discover meaningful activities and build genuine connections</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-6 pb-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onEmailSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormControl>
                      <Input 
                        placeholder="Full Name" 
                        {...field} 
                        autoComplete="name"
                        className="h-10"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormControl>
                      <Input 
                        placeholder="Username" 
                        {...field} 
                        autoComplete="username"
                        className="h-10"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="Email" 
                      {...field} 
                      autoComplete="email"
                      className="h-10"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="Password" 
                        {...field} 
                        autoComplete="new-password"
                        className="h-10 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isSubmitting}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  {passwordValue && passwordStrength > 0 && (
                    <div className="flex items-center gap-2">
                      <Progress value={(passwordStrength / 5) * 100} className="h-1.5 flex-1" />
                      <span className={`text-xs font-medium ${strengthInfo.color}`}>
                        {strengthInfo.label}
                      </span>
                    </div>
                  )}
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type={showConfirmPassword ? "text" : "password"} 
                        placeholder="Confirm Password" 
                        {...field} 
                        autoComplete="new-password"
                        className="h-10 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={isSubmitting}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="agreeToTerms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-normal">
                      I agree to the{' '}
                      <Link href="/terms" className="text-primary hover:underline" target="_blank">
                        Terms of Service
                      </Link>
                      {' '}and{' '}
                      <Link href="/privacy" className="text-primary hover:underline" target="_blank">
                        Privacy Policy
                      </Link>
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors duration-200" 
              disabled={isSubmitting || isGoogleSubmitting || !form.formState.isValid || !form.formState.isDirty}
              title={!form.formState.isDirty ? 'Please fill in all required fields' : !form.formState.isValid ? 'Please fix validation errors' : ''}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </Button>
          </form>
        </Form>

                    <div className="flex items-center my-4 gap-3">
              <span className="flex-1 border-t border-border/30" />
              <span className="text-muted-foreground font-medium text-xs">
                Or continue with
              </span>
              <span className="flex-1 border-t border-border/30" />
            </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 h-10"
            onClick={handleGoogleSignUp}
            disabled={isSubmitting || isGoogleSubmitting}
          >
            {isGoogleSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
          </Button>
        </div>
      </CardContent>
      <CardFooter className="justify-center py-3">
        <p className="text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-orange-500 hover:text-orange-600">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
