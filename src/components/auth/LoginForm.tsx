
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
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useRouter } from 'next/navigation'; // Removed useSearchParams as it's not used here

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
  const [showPasswordResetForm, setShowPasswordResetForm] = useState(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);

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
      const searchParams = new URLSearchParams(window.location.search);
      const redirectPath = searchParams.get('redirect');
      searchParams.delete('redirect'); 
      
      if (redirectPath) {
        const finalRedirect = redirectPath + (searchParams.toString() ? `?${searchParams.toString()}` : '');
        router.push(finalRedirect);
        return;
      }
      // AuthContext handles default redirect if no redirectPath
    } catch (error: any) {
      console.error('Login Form: Google Sign-In error:', error.code, error.message, error);
      let description = 'An unexpected error occurred. Please try again.';
      if (error.code === 'auth/popup-closed-by-user') {
        description = 'Google Sign-In was cancelled. This can happen if popups are blocked or if this website is not an "Authorized JavaScript origin" in your Google Cloud Console OAuth settings for this Firebase project. Please check your browser settings and OAuth configuration, then try again.';
      } else if (error.code === 'auth/unauthorized-domain') {
        description = 'This website domain is not authorized for Google Sign-In. Please check your Firebase project settings.';
      } else if (error.message) {
        description = error.message;
      }
      toast({
        title: 'Login Failed',
        description: description,
        variant: 'destructive',
      });
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const onEmailLoginSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      await signInWithEmail(data.email, data.password);
      const searchParams = new URLSearchParams(window.location.search);
      const redirectPath = searchParams.get('redirect');
      searchParams.delete('redirect'); 
      
      if (redirectPath) {
        const finalRedirect = redirectPath + (searchParams.toString() ? `?${searchParams.toString()}` : '');
        router.push(finalRedirect);
        return;
      }
      // AuthContext handles default redirect
    } catch (error: any) {
      console.error('Email Sign-In error:', error);
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid email or password.',
        variant: 'destructive',
      });
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


  return (
    <Card className="w-full max-w-sm shadow-lg bg-gray-900/30 backdrop-blur-md border-gray-700/40 overflow-hidden rounded-2xl">
      <CardHeader className="text-center space-y-3 pb-4">
        <div className="flex flex-col items-center">
          <Link href="/" className="flex items-center gap-2 mb-2">
            <CrossandLogo className="h-8 w-8" />
            <span className="text-2xl font-bold text-gradient-primary font-redressed">Crossand</span>
          </Link>
        </div>
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
                  disabled={isSubmitting || isGoogleSubmitting || isSendingResetEmail}
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

            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 border-border/50 hover:bg-secondary/50"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting || isGoogleSubmitting || isSendingResetEmail}
              >
                {isGoogleSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 border-border/50 hover:bg-secondary/50"
                disabled
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 border-border/50 hover:bg-secondary/50"
                disabled
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
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
                disabled={isSendingResetEmail || isSubmitting || isGoogleSubmitting}
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
