import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export const handleGoogleAuthError = (error: any, toast: any, action: 'sign-in' | 'sign-up') => {
  console.error(`${action === 'sign-up' ? 'Signup' : 'Login'} Form: Google ${action === 'sign-up' ? 'Sign-Up' : 'Sign-In'} error:`, error.code, error.message, error);
  
  let description = 'An unexpected error occurred. Please try again.';
  if (error.code === 'auth/popup-closed-by-user') {
    description = `Google ${action === 'sign-up' ? 'Sign-Up' : 'Sign-In'} was cancelled. This can happen if popups are blocked or if this website is not an "Authorized JavaScript origin" in your Google Cloud Console OAuth settings for this Firebase project. Please check your browser settings and OAuth configuration, then try again.`;
  } else if (error.code === 'auth/unauthorized-domain') {
    description = 'This website domain is not authorized for Google authentication. Please check your Firebase project settings.';
  } else if (error.message) {
    description = error.message;
  }
  
  toast({
    title: `${action === 'sign-up' ? 'Sign-Up' : 'Login'} Failed`,
    description: description,
    variant: 'destructive',
  });
};

export const handleRedirect = (router: any) => {
  const searchParams = new URLSearchParams(window.location.search);
  const redirectPath = searchParams.get('redirect');
  searchParams.delete('redirect');
  
  if (redirectPath) {
    const finalRedirect = redirectPath + (searchParams.toString() ? `?${searchParams.toString()}` : '');
    router.push(finalRedirect);
    return true;
  }
  return false;
};

export const handleEmailAuthError = (error: any, toast: any, action: 'sign-in' | 'sign-up') => {
  console.error(`Email ${action === 'sign-up' ? 'Sign-Up' : 'Sign-In'} error:`, error);
  
  let errorMessage = 'An unexpected error occurred.';
  
  if (error.code === 'auth/email-already-in-use') {
    errorMessage = 'An account with this email already exists. Please try logging in instead.';
  } else if (error.code === 'auth/weak-password') {
    errorMessage = 'Password is too weak. Please choose a stronger password.';
  } else if (error.code === 'auth/invalid-email') {
    errorMessage = 'Please enter a valid email address.';
  } else if (error.code === 'auth/user-not-found') {
    errorMessage = 'No account found with this email address.';
  } else if (error.code === 'auth/wrong-password') {
    errorMessage = 'Invalid email or password.';
  } else if (error.message) {
    errorMessage = error.message;
  }
  
  toast({
    title: `${action === 'sign-up' ? 'Sign-Up' : 'Login'} Failed`,
    description: errorMessage,
    variant: 'destructive',
  });
}; 