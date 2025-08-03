'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon as Loader2, EyeIcon, EyeSlashIcon, ChevronLeftIcon, UserIcon, EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { sendEmailVerification } from 'firebase/auth';
import { useIsMobile } from '@/hooks/use-is-mobile';

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" width="18" height="18" className="mr-2">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.53-4.18 7.09-10.36 7.09-17.65z"></path>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
    <path fill="none" d="M0 0h48v48H0z"></path>
  </svg>
);

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" className="mr-2">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

const signupFormSchema = z.object({
  fullName: z.string()
    .min(2, { message: 'Full name must be at least 2 characters.' })
    .max(50, { message: 'Full name cannot exceed 50 characters.' })
    .regex(/^[a-zA-Z\s'-]+$/, { message: 'Full name can only contain letters, spaces, hyphens, and apostrophes.' }),
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

export default function SignupFormMobile() {
  const isMobile = useIsMobile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const { toast } = useToast();
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();
  
  const siteName = settings?.siteName || 'Crossand';

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      agreeToTerms: false,
    },
  });

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
      await signInWithGoogle();
      // AuthContext will handle default redirect
    } catch (error: any) {
      console.error('Signup Form: Google Sign-Up error:', error.code, error.message, error);
      let description = 'An unexpected error occurred. Please try again.';
      if (error.code === 'auth/popup-closed-by-user') {
        description = 'Google Sign-Up was cancelled. Please try again.';
      } else if (error.code === 'auth/unauthorized-domain') {
        description = 'This website domain is not authorized for Google Sign-Up.';
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

  const onSubmit = async (data: SignupFormValues) => {
    setIsSubmitting(true);
    try {
      console.log('[SignupFormMobile] Starting signup process...');
      const user = await signUpWithEmail(data.email, data.password, data.fullName);
      
      if (user) {
        console.log('[SignupFormMobile] User created successfully, sending email verification...');
        try {
          const actionCodeSettings = {
            url: `${window.location.origin}/onboarding`,
            handleCodeInApp: true
          };
          await sendEmailVerification(user, actionCodeSettings);
          console.log('[SignupFormMobile] Email verification sent successfully');
          router.push(`/signup?verify=1&email=${encodeURIComponent(data.email)}`);
          return;
        } catch (verificationError) {
          console.error('[SignupFormMobile] Email verification error:', verificationError);
          toast({
            title: 'Account Created',
            description: 'Account created but verification email failed to send. You can resend it from your profile.',
            variant: 'default',
          });
          router.push(`/signup?verify=1&email=${encodeURIComponent(data.email)}`);
          return;
        }
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

  if (!isMobile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black relative">
      {/* Background Image */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/images/login-background.jpg)', filter: 'brightness(0.4)', backgroundColor: '#1a1a1a' }} />
      <div className="fixed inset-0 backdrop-blur-md" />
      <div className="fixed inset-0 bg-gradient-to-b from-black/95 via-black/70 to-black/0 pointer-events-none" />
      
      {/* Navigation Header */}
      <div className="flex items-center justify-between px-4 py-6 relative z-10">
        <button 
          onClick={() => router.push('/login')}
          className="w-12 h-12 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center"
        >
          <ChevronLeftIcon className="h-7 w-7 text-white" />
        </button>
        <div className="w-12"></div> {/* Spacer for centering */}
      </div>

      {/* Main Content */}
      <div className="px-6 py-8 relative z-10">
        {/* Header */}
        <div className="text-left mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Join <span className="text-orange-500 font-redressed">Crossand</span>
          </h1>
          <p className="text-gray-300 text-base">
            Join now to start planning amazing experiences with friends and family.
          </p>
        </div>

        {/* Form Card */}
        <div className="mb-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Full Name */}
            <div>
              <div className="relative">
                <input
                  {...form.register('fullName')}
                  type="text"
                  placeholder="Enter your full name"
                  className={`w-full px-4 py-3 pl-12 rounded-lg bg-gray-900/80 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors ${
                    form.formState.errors.fullName ? 'border-red-500' : ''
                  }`}
                />
                <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
              {form.formState.errors.fullName && (
                <p className="text-red-400 text-xs mt-1">
                  {form.formState.errors.fullName.message}
                </p>
              )}
            </div>



            {/* Email */}
            <div>
              <div className="relative">
                <input
                  {...form.register('email')}
                  type="email"
                  placeholder="Enter your email address"
                  className={`w-full px-4 py-3 pl-12 rounded-lg bg-gray-900/80 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors ${
                    form.formState.errors.email ? 'border-red-500' : ''
                  }`}
                />
                <EnvelopeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
              {form.formState.errors.email && (
                <p className="text-red-400 text-xs mt-1">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="relative">
                <input
                  {...form.register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  className={`w-full px-4 py-3 pl-12 pr-12 rounded-lg bg-gray-900/80 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors ${
                    form.formState.errors.password ? 'border-red-500' : ''
                  }`}
                />
                <LockClosedIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-orange-500"
                >
                  {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-red-400 text-xs mt-1">
                  {form.formState.errors.password.message}
                </p>
              )}
              {passwordValue && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1 w-8 rounded-full ${
                          level <= passwordStrength ? 
                            (level <= 2 ? 'bg-red-400' : level <= 3 ? 'bg-yellow-400' : level <= 4 ? 'bg-blue-400' : 'bg-green-400') 
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  {strengthInfo.label && (
                    <span className={`text-xs ${strengthInfo.color}`}>
                      {strengthInfo.label}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <div className="relative">
                <input
                  {...form.register('confirmPassword')}
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  className={`w-full px-4 py-3 pl-12 pr-12 rounded-lg bg-gray-900/80 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors ${
                    form.formState.errors.confirmPassword ? 'border-red-500' : ''
                  }`}
                />
                <LockClosedIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-orange-500"
                >
                  {showConfirmPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="text-red-400 text-xs mt-1">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start gap-3 pt-2">
              <input
                {...form.register('agreeToTerms')}
                type="checkbox"
                className="w-5 h-5 text-orange-500 bg-gray-900/80 border-gray-600 rounded focus:ring-orange-400 focus:ring-2 mt-0.5"
              />
              <label className="text-sm text-gray-300 leading-relaxed">
                I agree with{' '}
                <a href="/terms" className="text-orange-500 hover:underline font-medium">
                  Terms
                </a>
                ,{' '}
                <a href="/privacy" className="text-orange-500 hover:underline font-medium">
                  Privacy Policy
                </a>
                .
              </label>
            </div>
            {form.formState.errors.agreeToTerms && (
              <p className="text-red-400 text-xs">
                {form.formState.errors.agreeToTerms.message}
              </p>
            )}

            {/* Create Account Button */}
            <button
              type="submit"
              disabled={isSubmitting || !form.formState.isValid}
              onPointerDown={() => setIsPressed(true)}
              onPointerUp={() => setIsPressed(false)}
              onPointerLeave={() => setIsPressed(false)}
              onTouchStart={() => setIsPressed(true)}
              onTouchEnd={() => setIsPressed(false)}
                              className={`w-full py-4 rounded-xl font-semibold text-white transition-all duration-75 ${
                  isPressed ? 'scale-98' : ''
                } ${
                  isSubmitting || !form.formState.isValid 
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 shadow-lg'
                }`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Creating Account...
                </div>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        {/* Divider */}
        <div className="flex items-center my-6">
          <span className="flex-1 border-t border-gray-600" />
          <span className="px-4 text-sm text-gray-400 font-medium">
            or Continue with
          </span>
          <span className="flex-1 border-t border-gray-600" />
        </div>

        {/* Social Login Button */}
        <div>
          <button
            onClick={handleGoogleSignUp}
            disabled={isGoogleSubmitting}
            className="w-full py-3 px-4 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            {isGoogleSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <>
                <GoogleIcon />
                Google
              </>
            )}
          </button>
        </div>

        {/* Sign In Link */}
        <div className="text-center mt-8">
          <p className="text-gray-300 text-sm">
            Already have an account?{' '}
            <button 
              onClick={() => router.push('/login')}
              className="text-orange-500 font-semibold hover:underline"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
} 