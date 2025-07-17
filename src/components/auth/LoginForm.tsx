
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Phone, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useRouter } from 'next/navigation';
import { AuthHeader } from './shared/AuthComponents';
import { handleGoogleAuthError, handleRedirect, handleEmailAuthError } from './shared/AuthUtils';
import { PhoneAuthForm } from './PhoneAuthForm';

const loginFormSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});
type LoginFormValues = z.infer<typeof loginFormSchema>;

const resetPasswordSchema = z.object({
  resetEmail: z.string().email({ message: 'Please enter a valid email address.' }),
});
type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export function LoginForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isPhoneSubmitting, setIsPhoneSubmitting] = useState(false);
  const [showPasswordResetForm, setShowPasswordResetForm] = useState(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [showPhoneForm, setShowPhoneForm] = useState(false);

  const { toast } = useToast();
  const { signInWithEmail, signInWithGoogle, sendPasswordReset } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();
  
  const siteName = settings?.siteName || 'Macaroom';

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const resetForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      resetEmail: '',
    },
  });

  const handleGoogleSignIn = async () => {
    setIsGoogleSubmitting(true);
    try {
      await signInWithGoogle();
      if (!handleRedirect(router)) {
      // AuthContext handles default redirect if no redirectPath
      }
    } catch (error: any) {
      handleGoogleAuthError(error, toast, 'sign-in');
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handlePhoneSignIn = () => {
    setShowPhoneForm(true);
  };

  const onEmailLoginSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      await signInWithEmail(data.email, data.password);
      if (!handleRedirect(router)) {
      // AuthContext handles default redirect
      }
    } catch (error: any) {
      handleEmailAuthError(error, toast, 'sign-in');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetPasswordSubmit = async (data: ResetPasswordFormValues) => {
    setIsSendingResetEmail(true);
    try {
      await sendPasswordReset(data.resetEmail);
      toast({
        title: 'Password Reset Email Sent',
        description: 'If an account exists for this email, a password reset link has been sent. Please check your inbox (and spam folder).',
      });
      setShowPasswordResetForm(false); // Go back to login form
      resetForm.reset(); // Clear the reset email field
    } catch (error: any) {
      console.error('Password Reset error:', error);
      toast({
        title: 'Password Reset Failed',
        description: error.message || 'Could not send password reset email. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  if (showPhoneForm) {
    return (
      <Card className="w-full shadow-lg bg-gray-900/30 backdrop-blur-md border-gray-700/40 overflow-hidden rounded-2xl">
        <CardHeader className="text-center space-y-3 pb-4">
          <AuthHeader siteName={siteName} />
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-foreground">
              Sign in with Phone
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Enter your phone number to receive a verification code
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-4">
          <PhoneAuthForm />
        </CardContent>
        <CardFooter className="justify-center text-sm py-4 px-6">
          <div className="flex flex-col items-center space-y-3">
            <p className="text-muted-foreground text-xs">Or continue with</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-10 border-border/50 hover:bg-secondary/50"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting || isGoogleSubmitting || isPhoneSubmitting || isSendingResetEmail}
              >
                {isGoogleSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                Google
              </Button>
              <Button
                variant="outline"
                className="h-10 border-border/50 hover:bg-secondary/50"
                onClick={() => setShowPhoneForm(false)}
                disabled={isSubmitting || isGoogleSubmitting || isPhoneSubmitting || isSendingResetEmail}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">
              Don't have an account?{' '}
              <Link href="/signup" className="font-medium text-orange-500 hover:underline">
                Sign Up
              </Link>
            </p>
          </div>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-lg bg-gray-900/30 backdrop-blur-md border-gray-700/40 overflow-hidden rounded-2xl">
      <CardHeader className="text-center space-y-3 pb-4">
        <AuthHeader siteName={siteName} />
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold text-foreground">
            {showPasswordResetForm ? 'Reset Password' : 'Welcome Back'}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {showPasswordResetForm 
              ? 'Enter your email to receive a reset link' 
              : `Sign in to your ${siteName} account`}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-6 pb-4">
        {!showPasswordResetForm ? (
          <>
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onEmailLoginSubmit)} className="space-y-3">
                <FormField
                  control={loginForm.control}
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
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <div className="flex justify-end items-center mb-1">
                        <Button
                          type="button"
                          variant="link"
                          className="text-xs text-primary hover:underline p-0 h-auto font-normal"
                          onClick={() => {
                            setShowPasswordResetForm(true);
                            loginForm.reset();
                          }}
                        >
                          Forgot Password?
                        </Button>
                      </div>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Password" 
                          {...field} 
                          autoComplete="current-password"
                          className="h-10"
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full h-10 mt-4 bg-orange-500 hover:bg-orange-600 text-white font-medium" 
                  disabled={isSubmitting || isGoogleSubmitting || isPhoneSubmitting || isSendingResetEmail}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login
                </Button>
              </form>
            </Form>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/30" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-gray-900/30 backdrop-blur-sm px-3 text-muted-foreground font-medium">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-10 border-border/50 hover:bg-secondary/50"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting || isGoogleSubmitting || isPhoneSubmitting || isSendingResetEmail}
              >
                {isGoogleSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                Google
              </Button>
              <Button
                variant="outline"
                className="h-10 border-border/50 hover:bg-secondary/50"
                onClick={handlePhoneSignIn}
                disabled={isSubmitting || isGoogleSubmitting || isPhoneSubmitting || isSendingResetEmail}
              >
                {isPhoneSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Phone className="h-4 w-4 mr-2" />
                )}
                Phone
              </Button>
            </div>
          </>
        ) : (
          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(onResetPasswordSubmit)} className="space-y-3">
              <FormField
                control={resetForm.control}
                name="resetEmail"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="Email Address" 
                        {...field} 
                        autoComplete="email"
                        className="h-10"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full h-10 mt-4 bg-orange-500 hover:bg-orange-600 text-white font-medium" 
                disabled={isSendingResetEmail || isSubmitting || isGoogleSubmitting || isPhoneSubmitting}
              >
                {isSendingResetEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
      <CardFooter className="justify-center text-sm py-4 px-6">
        {showPasswordResetForm ? (
          <Button
            type="button"
            variant="link"
            className="text-muted-foreground hover:text-primary p-0 h-auto text-sm font-normal"
            onClick={() => {
              setShowPasswordResetForm(false);
              resetForm.reset();
            }}
          >
            Back to Login
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">
            Don't have an account?{' '}
            <Link href="/signup" className="font-medium text-orange-500 hover:underline">
              Sign Up
            </Link>
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
