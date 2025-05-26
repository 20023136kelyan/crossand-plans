
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
import { useRouter, useSearchParams } from 'next/navigation';

const MacaronLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M52,22.04C52,14.29,43.71,8,34,8H30C20.29,8,12,14.29,12,22.04a2.5,2.5,0,0,0,0,.27C12,25.25,16.42,30,26,30h12C47.58,30,52,25.25,52,22.31A2.5,2.5,0,0,0,52,22.04Z" />
    <rect x="10" y="30" width="44" height="4" rx="2" ry="2" />
    <path d="M52,41.96C52,49.71,43.71,56,34,56H30C20.29,56,12,49.71,12,41.96a2.5,2.5,0,0,1,0-.27C12,38.75,16.42,34,26,34h12C47.58,34,52,38.75,52,41.69A2.5,2.5,0,0,1,52,41.96Z" />
  </svg>
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
  fullName: z.string().min(2, { message: 'Full name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

type SignupFormValues = z.infer<typeof signupFormSchema>;

export function SignupForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const { toast } = useToast();
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();
  const searchParamsHook = useSearchParams();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

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
      await signUpWithEmail(data.email, data.password, data.fullName);
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
      console.error('Email Sign-Up error:', error);
      toast({
        title: 'Sign-Up Failed',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-xl bg-card/90 border-border/50">
      <CardHeader className="text-center space-y-2">
        <div className="flex flex-col items-center">
          <Link href="/" className="flex items-center gap-2 mb-1">
            <MacaronLogo className="h-10 w-10 text-primary" />
            <span className="text-3xl font-bold text-primary">Macaroom</span>
          </Link>
        </div>
        <CardTitle className="text-xl font-bold text-primary opacity-80">Create Your Account</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">Join Macaroom and start planning today!</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onEmailSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} autoComplete="name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" {...field} autoComplete="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} autoComplete="new-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} autoComplete="new-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting || isGoogleSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign Up
            </Button>
          </form>
        </Form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/50" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignUp}
          disabled={isSubmitting || isGoogleSubmitting}
        >
          {isGoogleSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Sign up with Google
        </Button>
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <p className="text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
