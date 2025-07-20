import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useAuth } from '@/context/AuthContext';
import { ChevronLeft, Loader2, Mail, Smartphone, Eye, EyeOff, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/context/SettingsContext';
import { LinearBlur } from 'progressive-blur';
import { PhoneNumberUtil, PhoneNumberFormat, PhoneNumberType } from 'google-libphonenumber';
import type { ConfirmationResult } from 'firebase/auth';
import { countries } from '@/app/(app)/onboarding/countries';
import { getCountryFlagEmoji } from '@/lib/country-utils';
import { forceClearAllRecaptcha } from '@/lib/firebase';

export default function LoginFormMobile() {
  const { signInWithPhone, confirmPhoneCode, signInWithGoogle, signInWithEmail, sendPasswordReset } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailStep, setEmailStep] = useState(0); // 0: input, 1: code
  const [code, setCode] = useState(['', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { settings } = useSettings();
  const siteName = settings?.siteName || 'Macaroom';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cooldownTime, setCooldownTime] = useState(0);
  const [canSubmit, setCanSubmit] = useState(true);
  const [authError, setAuthError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmailError, setResetEmailError] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  // Forgot password flow states (must be top-level)
  const [showSuccess, setShowSuccess] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [buttonSent, setButtonSent] = useState(false);
  const loadingTimeout = useRef<NodeJS.Timeout | null>(null);
  // Remove loading bar state
  const [isPressed, setIsPressed] = useState(false);
  // Press states for all main buttons
  const [isGooglePressed, setIsGooglePressed] = useState(false);
  const [isEmailPressed, setIsEmailPressed] = useState(false);
  const [isPhonePressed, setIsPhonePressed] = useState(false);
  const [isBackPressed, setIsBackPressed] = useState(false);
  const [isForgotPressed, setIsForgotPressed] = useState(false);
  const [isBackToLoginPressed, setIsBackToLoginPressed] = useState(false);
  const [showPhoneScreen, setShowPhoneScreen] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isPhoneSubmitting, setIsPhoneSubmitting] = useState(false);
  const [phoneStep, setPhoneStep] = useState(0); // 0: input, 1: code sent placeholder
  // Phone login full flow
  const [countryCode, setCountryCode] = useState('+1');
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState('');
  const [isCodeSubmitting, setIsCodeSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const resendIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize phone number utility
  const phoneUtil = PhoneNumberUtil.getInstance();

  // Get current country data
  const currentSelectedCountryData = countries.find((c: any) => c.code === selectedCountry);

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

  // Start resend timer
  const startResendTimer = () => {
    setResendTimer(60);
    if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
    resendIntervalRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
    };
  }, []);

  // Phone number validation function
  const validatePhoneNumber = (phone: string, countryCode: string) => {
    try {
      const fullNumber = countryCode + phone;
      const phoneNumber = phoneUtil.parse(fullNumber);
      
      if (!phoneUtil.isValidNumber(phoneNumber)) {
        return { isValid: false, error: 'Invalid phone number format' };
      }
      
      const numberType = phoneUtil.getNumberType(phoneNumber);
      if (numberType !== PhoneNumberType.MOBILE && numberType !== PhoneNumberType.FIXED_LINE_OR_MOBILE) {
        return { isValid: false, error: 'Please enter a mobile number' };
      }
      
      return { isValid: true, formattedNumber: phoneUtil.format(phoneNumber, PhoneNumberFormat.E164) };
    } catch (error) {
      return { isValid: false, error: 'Invalid phone number' };
    }
  };

  // Handle sending verification code
  const handlePhoneSubmit = async () => {
    if (!phone) {
      setPhoneError('Phone number is required');
      return;
    }
    
    const validation = validatePhoneNumber(phone, countryCode);
    if (!validation.isValid) {
      setPhoneError(validation.error || 'Invalid phone number');
      return;
    }

    // Check cooldown
    if (!canSubmit) {
      toast({
        title: 'Please Wait',
        description: `Please wait ${cooldownTime} seconds before trying again.`,
        variant: 'destructive',
      });
      return;
    }
    
    setIsPhoneSubmitting(true);
    setLastError(null);
    
    // Ensure page is fully loaded before attempting phone auth
    if (document.readyState !== 'complete') {
      toast({
        title: 'Please Wait',
        description: 'Page is still loading. Please wait a moment and try again.',
        variant: 'destructive',
      });
      setIsPhoneSubmitting(false);
      return;
    }
    
    try {
      // Force clear all reCAPTCHA instances before attempting authentication
      forceClearAllRecaptcha();
      
      // Additional aggressive clearing for 401 errors
      if (typeof window !== 'undefined') {
        // Clear any cached reCAPTCHA data
        try {
          localStorage.removeItem('recaptcha');
          sessionStorage.removeItem('recaptcha');
        } catch (error) {
          console.log('[LoginFormMobile] Error clearing reCAPTCHA storage:', error);
        }
        
        // Clear any reCAPTCHA scripts that might be cached
        const recaptchaScripts = document.querySelectorAll('script[src*="recaptcha"]');
        recaptchaScripts.forEach(script => {
          try {
            script.remove();
          } catch (error) {
            console.log('[LoginFormMobile] Error removing reCAPTCHA script:', error);
          }
        });
      }
      
      // Wait a moment for the clear to take effect
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Combine country code and phone number
      const fullPhoneNumber = `${currentSelectedCountryData?.dialCode}${phone.replace(/\D/g, '')}`;
      
      // The signInWithPhone function from AuthContext already handles reCAPTCHA initialization
      const result = await signInWithPhone(fullPhoneNumber);
      setConfirmationResult(result);
      setPhoneStep(1);
      startResendTimer();
      toast({
        title: 'Verification Code Sent',
        description: 'A 6-digit verification code has been sent to your phone number.',
      });
      
      // Set cooldown to prevent rapid attempts
      setCooldownTime(60); // 60 seconds cooldown
      setCanSubmit(false);
      
    } catch (error: any) {
      console.error('Phone Sign-In error:', error);
      
      // Handle rate limiting with longer cooldown
      if (error.message?.includes('Too many attempts') || error.code === 'auth/too-many-requests') {
        setCooldownTime(120); // 2 minutes cooldown for rate limiting
        setCanSubmit(false);
        setLastError('Too many attempts. Please wait 2 minutes before trying again.');
        return;
      }
      
      setLastError(error.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsPhoneSubmitting(false);
    }
  };

  // Handle code verification
  const handleVerifyCode = async () => {
    if (!confirmationResult) {
      toast({
        title: 'Error',
        description: 'No verification session found. Please try sending the code again.',
        variant: 'destructive',
      });
      return;
    }

    setCodeError('');
    const codeStr = code.join('');
    if (!/^\d{6}$/.test(codeStr)) {
      setCodeError('Enter the 6-digit code');
      return;
    }

    setIsCodeSubmitting(true);
    try {
      await confirmPhoneCode(confirmationResult, codeStr);
      toast({
        title: 'Success',
        description: 'Phone number verified successfully!',
      });
      // AuthContext will handle redirect
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
      
      setCodeError(errorMessage);
      toast({
        title: 'Verification Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsCodeSubmitting(false);
    }
  };

  // Handle resend code
  const handleResendCode = async () => {
    if (resendTimer > 0 || isResending) return;
    
    setIsResending(true);
    try {
      const fullPhoneNumber = `${currentSelectedCountryData?.dialCode}${phone.replace(/\D/g, '')}`;
      const result = await signInWithPhone(fullPhoneNumber);
      setConfirmationResult(result);
      startResendTimer();
      toast({
        title: 'Code Resent',
        description: 'A new verification code has been sent to your phone number.',
      });
    } catch (error: any) {
      console.error('Resend code error:', error);
      let errorMessage = 'Failed to resend code. Please try again.';
      
      if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please wait before trying again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Resend Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  // Phone number formatting function
  const formatPhoneNumber = (value: string, countryCode: string) => {
    try {
      // Remove all non-digits
      const digitsOnly = value.replace(/\D/g, '');
      
      // If no digits, return empty
      if (!digitsOnly) return '';
      
      // Try to parse and format
      const fullNumber = countryCode + digitsOnly;
      const phoneNumber = phoneUtil.parse(fullNumber);
      
      if (phoneUtil.isValidNumber(phoneNumber)) {
        // Format as national number (e.g., (555) 123-4567)
        return phoneUtil.format(phoneNumber, PhoneNumberFormat.NATIONAL).replace(countryCode + ' ', '');
      } else {
        // If not valid yet, just format digits with basic spacing
        return formatDigitsOnly(digitsOnly);
      }
    } catch (error) {
      // Fallback to basic formatting
      return formatDigitsOnly(value.replace(/\D/g, ''));
    }
  };

  // Basic digit formatting fallback
  const formatDigitsOnly = (digits: string) => {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  // Only render on mobile
  if (!isMobile) return null;

  // Handlers (stub for now, integrate with your logic)
  const handleGoogleSignIn = async () => {
    setIsGoogleSubmitting(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  // UI
  if (showEmail) {
    if (showForgotPassword) {
      // Handler for sending reset link
      const handleSendReset = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!resetEmail) { setResetEmailError('Email is required'); return; }
        if (!/^\S+@\S+\.\S+$/.test(resetEmail)) { setResetEmailError('Enter a valid email address'); return; }
        setIsPressed(false); // ensure released
        setTimeout(async () => {
          setIsSendingReset(true);
          setButtonLoading(true);
          setButtonSent(false);
          try {
            await sendPasswordReset(resetEmail);
            setButtonLoading(false);
            setButtonSent(true);
            // Show 'Sent! 🎉' for 1 second
            await new Promise(res => setTimeout(res, 1000));
            setButtonSent(false);
            setShowSuccess(true);
            setShowChangeEmail(false);
            setResetEmailError('');
            setResetEmail('');
          } catch (error: any) {
            if (error?.code === 'auth/too-many-requests') {
              setResetEmailError('Too many requests. Please try again later.');
            } else {
              setResetEmailError(error?.message || 'Could not send reset email');
            }
            setButtonLoading(false);
            setButtonSent(false);
          } finally {
            setIsSendingReset(false);
          }
        }, 40);
      };

      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center min-h-screen bg-black/90">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/images/login-background.jpg)', filter: 'brightness(0.4)', backgroundColor: '#1a1a1a', zIndex: 0 }} />
          <div className="fixed inset-0 backdrop-blur-md z-0" />
          <div className="fixed inset-0 bg-gradient-to-b from-black/95 via-black/70 to-black/0 z-10 pointer-events-none" />
          <div className="relative z-20 w-full max-w-sm mx-auto px-4 mt-12 pb-32">
            <button className="mb-6 text-white" aria-label="Back to login" onClick={() => { setShowForgotPassword(false); setShowSuccess(false); setShowChangeEmail(false); }}>
              <ChevronLeft className="h-7 w-7 text-white font-bold" />
            </button>
            {/* Success State: Check Inbox */}
            {showSuccess && !showChangeEmail ? (
              <div className="flex flex-col items-center justify-center w-full">
                <h2 className="text-2xl font-bold text-white mb-2">Check your inbox</h2>
                <p className="text-sm text-gray-300 mb-6 text-center">We've sent a password reset link to your email.<br />Please check your inbox.</p>
                <button
                  className="text-orange-400 hover:underline text-sm font-medium mb-4"
                  onClick={() => setShowChangeEmail(true)}
                >
                  Didn't receive the link? Change email
                </button>
                <Button
                  className="w-full h-12 rounded-full font-semibold text-base mt-2"
                  onClick={() => { setShowForgotPassword(false); setShowSuccess(false); setShowChangeEmail(false); }}
                >
                  Back to Login
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-white mb-2">Reset your password</h2>
                <p className="text-sm text-gray-300 mb-6">Enter your email to receive a reset link.</p>
                <form onSubmit={handleSendReset}>
                  {showChangeEmail && (
                    <div className="mb-4 text-sm text-gray-300">Enter a different email address:</div>
                  )}
                  <input
                    type="email"
                    aria-label="Email address"
                    className={`w-full rounded-lg bg-gray-900/80 border border-gray-700 text-white px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-orange-400 ${resetEmailError ? 'border-red-500' : ''}`}
                    placeholder="Email Address"
                    autoComplete="email"
                    value={resetEmail}
                    onChange={e => {
                      setResetEmail(e.target.value);
                      setResetEmailError('');
                    }}
                    onBlur={() => {
                      if (!resetEmail) setResetEmailError('Email is required');
                      else if (!/^\S+@\S+\.\S+$/.test(resetEmail)) setResetEmailError('Enter a valid email address');
                      else setResetEmailError('');
                    }}
                    aria-describedby={resetEmailError ? 'reset-email-error' : undefined}
                  />
                  {resetEmailError && <div id="reset-email-error" className="text-xs text-red-500 mb-2 pl-1">{resetEmailError}</div>}
                  <button
                    type="submit"
                    aria-label="Send Reset Link"
                    className={`w-full h-12 rounded-full font-semibold text-base mt-2 bg-gradient-to-r from-orange-400 to-yellow-400 text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-500 relative overflow-hidden flex items-center justify-center transition-transform duration-100 ${isPressed ? 'scale-95' : ''}`}
                    disabled={isSendingReset || !!resetEmailError || !resetEmail || buttonLoading || buttonSent}
                    style={{ position: 'relative' }}
                    onPointerDown={() => setIsPressed(true)}
                    onPointerUp={() => setIsPressed(false)}
                    onPointerLeave={() => setIsPressed(false)}
                    onTouchStart={() => setIsPressed(true)}
                    onTouchEnd={() => setIsPressed(false)}
                  >
                    {/* Spinner while loading */}
                    {buttonLoading && !buttonSent && (
                      <span className="absolute inset-0 flex items-center justify-center z-30">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </span>
                    )}
                    {/* Sent state with bounce animation */}
                    {buttonSent && (
                      <span className="absolute inset-0 flex items-center justify-center z-30 animate-bounce bg-transparent">Sent! <span role="img" aria-label="party">🎉</span></span>
                    )}
                    {/* Default text */}
                    {!buttonLoading && !buttonSent && (
                      <span className="relative z-20 w-full flex items-center justify-center">Send Reset Link</span>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      );
    } else if (emailStep === 0) {
      return (
        <div className="min-h-screen flex flex-col items-center bg-black relative">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/images/login-background.jpg)', filter: 'brightness(0.4)', backgroundColor: '#1a1a1a', zIndex: 0 }} />
          <div className="fixed inset-0 backdrop-blur-md z-0" />
          <div className="fixed inset-0 bg-gradient-to-b from-black/95 via-black/70 to-black/0 z-10 pointer-events-none" />
          <div className="relative z-20 w-full max-w-sm mx-auto px-4 mt-12 pb-32">
            <button className="mb-6 text-white" onClick={() => setShowEmail(false)}>
              <ChevronLeft className="h-7 w-7 text-white font-bold" />
            </button>
            <h2 className="text-3xl font-bold text-white mb-2 text-left pl-3">Continue with email</h2>
            <p className="text-base text-gray-300 mb-6 text-left pl-3">Sign in to your <span className="text-orange-500 font-redressed text-xl">{siteName}</span> account.</p>
            <form className="relative z-20 w-full max-w-sm mx-auto px-4 mt-12 pb-32" onSubmit={async (e) => {
              e.preventDefault();
              setAuthError('');
              if (!email) { setEmailError('Email is required'); return; }
              if (!/^\S+@\S+\.\S+$/.test(email)) { setEmailError('Enter a valid email address'); return; }
              if (!password) { setPasswordError('Password is required'); return; }
              if (password.length < 6) { setPasswordError('Password must be at least 6 characters'); return; }
              setIsSubmitting(true);
              try {
                await signInWithEmail(email, password);
              } catch (error: any) {
                setAuthError(error?.message || 'Login failed. Please try again.');
              } finally {
                setIsSubmitting(false);
              }
            }}>
              <div className="relative mb-4">
                <input
                  type="email"
                  aria-label="Email address"
                  className={`w-full rounded-lg bg-gray-900/80 border border-gray-700 text-white px-4 py-3 pl-12 focus:outline-none focus:ring-2 focus:ring-orange-400 ${emailError ? 'border-red-500' : ''}`}
                  placeholder="Enter Address"
                  autoComplete="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    setEmailError('');
                    setAuthError('');
                    if (!showForgotPassword) setResetEmail(e.target.value); // keep in sync unless modal is open
                  }}
                  onBlur={() => {
                    if (!email) setEmailError('Email is required');
                    else if (!/^\S+@\S+\.\S+$/.test(email)) setEmailError('Enter a valid email address');
                    else setEmailError('');
                  }}
                  aria-describedby={emailError ? 'email-error' : undefined}
                />
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
              {emailError && <div id="email-error" className="text-xs text-red-500 mb-2 pl-1">{emailError}</div>}
            {/* Password Field with error and forgot password */}
            <div className="relative mb-4">
              <input
                type={showPassword ? "text" : "password"}
                aria-label="Password"
                className={`w-full rounded-lg bg-gray-900/80 border border-gray-700 text-white px-4 py-3 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-orange-500 ${passwordError ? 'border-red-500' : ''}`}
                placeholder="Password"
                autoComplete="current-password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setPasswordError('');
                  setAuthError('');
                }}
                onBlur={() => {
                  if (!password) setPasswordError('Password is required');
                  else if (password.length < 6) setPasswordError('Password must be at least 6 characters');
                  else setPasswordError('');
                }}
                aria-describedby={passwordError ? 'password-error' : undefined}
              />
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 focus:outline-none"
                tabIndex={-1}
                onClick={() => setShowPassword(v => !v)}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {passwordError && <div className="text-xs text-red-500 mb-2 pl-1">{passwordError}</div>}
            {authError && <div className="text-xs text-red-500 mb-2 pl-1">{authError}</div>}
            {/* Forgot Password Fullscreen Overlay */}
            {showForgotPassword && (
              <div className="fixed inset-0 z-50 flex flex-col items-center justify-center min-h-screen bg-black/90">
                <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/images/login-background.jpg)', filter: 'brightness(0.4)', backgroundColor: '#1a1a1a', zIndex: 0 }} />
                <div className="fixed inset-0 backdrop-blur-md z-0" />
                <div className="fixed inset-0 bg-gradient-to-b from-black/95 via-black/70 to-black/0 z-10 pointer-events-none" />
                <div className="relative z-20 w-full max-w-sm mx-auto px-4 mt-12 pb-32">
                  <button className="mb-6 text-white" aria-label="Back to login" onClick={() => setShowForgotPassword(false)}>
                    <ChevronLeft className="h-7 w-7 text-white font-bold" />
                  </button>
                  <h2 className="text-2xl font-bold text-white mb-2">Reset your password</h2>
                  <p className="text-sm text-gray-300 mb-6">Enter your email to receive a reset link.</p>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!resetEmail) { setResetEmailError('Email is required'); return; }
                    if (!/^\S+@\S+\.\S+$/.test(resetEmail)) { setResetEmailError('Enter a valid email address'); return; }
                    setIsSendingReset(true);
                    try {
                      await sendPasswordReset(resetEmail);
                      toast({ title: 'Password Reset Email Sent', description: 'If an account exists for this email, a password reset link has been sent.' });
                      setShowForgotPassword(false);
                      setResetEmail('');
                    } catch (error: any) {
                      setResetEmailError(error?.message || 'Could not send reset email');
                    } finally {
                      setIsSendingReset(false);
                    }
                  }}>
                    <input
                      type="email"
                      aria-label="Email address"
                      className={`w-full rounded-lg bg-gray-900/80 border border-gray-700 text-white px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-orange-400 ${resetEmailError ? 'border-red-500' : ''}`}
                      placeholder="Email Address"
                      autoComplete="email"
                      value={resetEmail}
                      onChange={e => {
                        setResetEmail(e.target.value);
                        setResetEmailError('');
                      }}
                      onBlur={() => {
                        if (!resetEmail) setResetEmailError('Email is required');
                        else if (!/^\S+@\S+\.\S+$/.test(resetEmail)) setResetEmailError('Enter a valid email address');
                        else setResetEmailError('');
                      }}
                      aria-describedby={resetEmailError ? 'reset-email-error' : undefined}
                    />
                    {resetEmailError && <div id="reset-email-error" className="text-xs text-red-500 mb-2 pl-1">{resetEmailError}</div>}
                    <Button
                      type="submit"
                      aria-label="Send Reset Link"
                      className="w-full h-12 rounded-full font-semibold text-base focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-500 bg-orange-200 text-black mt-2"
                      disabled={isSendingReset || !!resetEmailError || !resetEmail}
                    >
                      {isSendingReset ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Send Reset Link'}
                    </Button>
                  </form>
                </div>
              </div>
            )}
            {/* Fixed Continue Button at Bottom */}
            </form>
            <div className="fixed left-0 right-0 bottom-0 z-50 px-4 pt-3 pb-6 flex flex-col items-center" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }} role="group" aria-label="Login actions">
              <button
                type="button"
                className={`text-xs text-orange-500 hover:underline font-medium mb-6 transition-transform duration-100 ${isForgotPressed ? 'scale-95' : ''}`}
                aria-label="Forgot Password?"
                onClick={() => {
                  setResetEmail(email); // prefill with main email field
                  setShowForgotPassword(true);
                }}
                onPointerDown={() => setIsForgotPressed(true)}
                onPointerUp={() => setIsForgotPressed(false)}
                onPointerLeave={() => setIsForgotPressed(false)}
                onTouchStart={() => setIsForgotPressed(true)}
                onTouchEnd={() => setIsForgotPressed(false)}
              >
                Forgot Password?
              </button>
              <button
                type="submit"
                aria-label="Continue"
                className={`max-w-xs mx-auto w-full h-12 rounded-full font-semibold text-base mt-2 bg-gradient-to-r from-orange-400 to-yellow-400 text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-500 relative overflow-hidden flex items-center justify-center transition-transform duration-100 ${isPressed ? 'scale-95' : ''} ${(!email || !password || !!emailError || !!passwordError || isSubmitting) ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={!email || !password || !!emailError || !!passwordError || isSubmitting}
                onPointerDown={() => setIsPressed(true)}
                onPointerUp={() => setIsPressed(false)}
                onPointerLeave={() => setIsPressed(false)}
                onTouchStart={() => setIsPressed(true)}
                onTouchEnd={() => setIsPressed(false)}
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      );
    } else {
      // Code entry step
      return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-black relative">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/images/login-background.jpg)', filter: 'brightness(0.4)', backgroundColor: '#1a1a1a', zIndex: 0 }} />
          <div className="relative z-10 w-full max-w-sm mx-auto px-4 py-8">
            <button className="mb-6 text-white" onClick={() => setEmailStep(0)}>&larr;</button>
            <h2 className="text-2xl font-bold text-white mb-2">Enter code</h2>
            <p className="text-sm text-gray-300 mb-6">We sent a verification code to your email<br /><span className="font-medium text-white">{email}</span></p>
            <div className="flex justify-between mb-6">
              {code.map((digit, idx) => (
                <input
                  key={idx}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className="w-12 h-12 rounded-lg bg-gray-900/80 border border-gray-700 text-white text-2xl text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
                  value={digit}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/, '');
                    const newCode = [...code];
                    newCode[idx] = val;
                    setCode(newCode);
                    // Auto-focus next
                    if (val && idx < 3) {
                      const next = document.getElementById(`code-input-${idx + 1}`);
                      if (next) (next as HTMLInputElement).focus();
                    }
                  }}
                  id={`code-input-${idx}`}
                />
              ))}
            </div>
            <Button
              className={`w-full h-12 rounded-lg font-semibold text-base ${code.every(d => d) ? 'bg-orange-200 text-black' : 'bg-gray-700 text-gray-400'}`}
              disabled={!code.every(d => d)}
            >
              Continue
            </Button>
            <p className="text-xs text-gray-400 mt-4">You didn't receive any code? <button className="underline">Resend Code</button></p>
          </div>
        </div>
      );
    }
  }

  if (showPhoneScreen) {
    // Step 1: Phone input
    if (phoneStep === 0) {
      return (
        <div className="min-h-screen flex flex-col items-center bg-black relative">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/images/login-background.jpg)', filter: 'brightness(0.4)', backgroundColor: '#1a1a1a', zIndex: 0 }} />
          <div className="fixed inset-0 backdrop-blur-md z-0" />
          <div className="fixed inset-0 bg-gradient-to-b from-black/95 via-black/70 to-black/0 z-10 pointer-events-none" />
          <div className="relative z-20 w-full max-w-sm mx-auto px-4 mt-12 pb-32">
            <button
              className={`mb-6 text-white transition-transform duration-100 ${isBackPressed ? 'scale-95' : ''}`}
              onClick={() => setShowPhoneScreen(false)}
              onPointerDown={() => setIsBackPressed(true)}
              onPointerUp={() => setIsBackPressed(false)}
              onPointerLeave={() => setIsBackPressed(false)}
              onTouchStart={() => setIsBackPressed(true)}
              onTouchEnd={() => setIsBackPressed(false)}
            >
              <ChevronLeft className="h-7 w-7 text-white font-bold" />
            </button>
            <h2 className="text-3xl font-bold text-white mb-2 text-left pl-3">Continue with phone</h2>
            <p className="text-base text-gray-300 mb-6 text-left pl-3">Sign in with the phone number linked to your <span className="text-orange-500 font-redressed text-xl">{siteName}</span> account.</p>
                            <form onSubmit={async (e) => {
                  e.preventDefault();
                  await handlePhoneSubmit();
                }}>
                  <div className="flex gap-2 mb-4 justify-center max-w-xs w-full mx-auto">
                    <select
                      className="rounded-lg bg-gray-900/80 border border-gray-700 text-white px-2 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400 appearance-none"
                      value={countryCode}
                      onChange={e => setCountryCode(e.target.value)}
                      aria-label="Country code"
                      style={{ minWidth: 80 }}
                    >
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+33">🇫🇷 +33</option>
                      <option value="+49">🇩🇪 +49</option>
                      <option value="+91">🇮🇳 +91</option>
                      <option value="+81">🇯🇵 +81</option>
                      <option value="+61">🇦🇺 +61</option>
                      <option value="+34">🇪🇸 +34</option>
                      <option value="+39">🇮🇹 +39</option>
                      <option value="+86">🇨🇳 +86</option>
                      {/* Add more as needed */}
                    </select>
                    <input
                      type="tel"
                      aria-label="Phone number"
                      className={`rounded-lg bg-gray-900/80 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400 max-w-xs w-full ${phoneError ? 'border-red-500' : ''}`}
                      placeholder="e.g. 5551234567"
                      autoComplete="tel"
                      value={phone}
                      onChange={e => {
                        setPhone(formatPhoneNumber(e.target.value, countryCode));
                        setPhoneError('');
                      }}
                      onBlur={() => {
                        if (!phone) setPhoneError('Phone number is required');
                        else {
                          const validation = validatePhoneNumber(phone, countryCode);
                          if (!validation.isValid) {
                            setPhoneError(validation.error || 'Enter a valid phone number');
                          } else {
                            setPhoneError('');
                          }
                        }
                      }}
                      aria-describedby={phoneError ? 'phone-error' : undefined}
                    />
                  </div>
              {phoneError && <div id="phone-error" className="text-xs text-red-500 mb-2 pl-1">{phoneError}</div>}
            </form>
            {/* Fixed Continue Button at Bottom */}
            <div className="fixed left-0 right-0 bottom-0 z-50 px-4 pt-3 pb-6 flex flex-col items-center" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }} role="group" aria-label="Phone login actions">
              <button
                type="button"
                aria-label="Continue"
                className={`max-w-xs mx-auto w-full h-12 rounded-full font-semibold text-base bg-gradient-to-r from-orange-400 to-yellow-400 text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-500 relative overflow-hidden flex items-center justify-center transition-transform duration-100 ${isPhonePressed ? 'scale-95' : ''} ${(isPhoneSubmitting || !phone || !!phoneError || cooldownTime > 0) ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={isPhoneSubmitting || !phone || !!phoneError || cooldownTime > 0}
                                    onClick={async () => {
                      await handlePhoneSubmit();
                    }}
                onPointerDown={() => setIsPhonePressed(true)}
                onPointerUp={() => setIsPhonePressed(false)}
                onPointerLeave={() => setIsPhonePressed(false)}
                onTouchStart={() => setIsPhonePressed(true)}
                onTouchEnd={() => setIsPhonePressed(false)}
              >
                {isPhoneSubmitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 
                 cooldownTime > 0 ? `Wait ${cooldownTime}s` : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      );
    }
    // Step 2: Code input
    if (phoneStep === 1) {
      return (
        <div className="min-h-screen flex flex-col items-center bg-black relative">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/images/login-background.jpg)', filter: 'brightness(0.4)', backgroundColor: '#1a1a1a', zIndex: 0 }} />
          <div className="fixed inset-0 backdrop-blur-md z-0" />
          <div className="fixed inset-0 bg-gradient-to-b from-black/95 via-black/70 to-black/0 z-10 pointer-events-none" />
          <div className="relative z-20 w-full max-w-sm mx-auto px-4 mt-12 pb-32 flex flex-col items-center justify-center">
            <button
              className={`mb-6 text-white transition-transform duration-100 ${isBackPressed ? 'scale-95' : ''}`}
              onClick={() => { setPhoneStep(0); setCode(['', '', '', '', '', '']); setCodeError(''); }}
              onPointerDown={() => setIsBackPressed(true)}
              onPointerUp={() => setIsBackPressed(false)}
              onPointerLeave={() => setIsBackPressed(false)}
              onTouchStart={() => setIsBackPressed(true)}
              onTouchEnd={() => setIsBackPressed(false)}
            >
              <ChevronLeft className="h-7 w-7 text-white font-bold" />
            </button>
            <h2 className="text-2xl font-bold text-white mb-2 text-center">Enter verification code</h2>
            <p className="text-sm text-gray-300 mb-6 text-center">A code was sent to <span className="text-orange-500 font-redressed text-lg">{countryCode} {phone}</span>.</p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              await handleVerifyCode();
            }}>
              <div className="flex gap-2 justify-center mb-4">
                {code.map((digit, idx) => (
                  <input
                    key={idx}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className="w-12 h-12 rounded-lg bg-gray-900/80 border border-gray-700 text-white text-2xl text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
                    value={digit}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/, '');
                      const newCode = [...code];
                      newCode[idx] = val;
                      setCode(newCode);
                      setCodeError('');
                      // Auto-focus next
                      if (val && idx < 5) {
                        const next = document.getElementById(`code-input-${idx + 1}`);
                        if (next) (next as HTMLInputElement).focus();
                      }
                    }}
                    id={`code-input-${idx}`}
                    aria-label={`Digit ${idx + 1}`}
                    onPaste={e => {
                      const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                      if (paste.length === 6) {
                        setCode(paste.split(''));
                        setCodeError('');
                        e.preventDefault();
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Backspace' && !code[idx] && idx > 0) {
                        const prev = document.getElementById(`code-input-${idx - 1}`);
                        if (prev) (prev as HTMLInputElement).focus();
                      }
                    }}
                  />
                ))}
              </div>
              {codeError && <div className="text-xs text-red-500 mb-2 pl-1 text-center w-full">{codeError}</div>}
            </form>
            {/* Resend code and timer */}
            <div className="flex flex-col items-center mt-4">
              <button
                type="button"
                className={`text-orange-400 hover:underline text-sm font-medium mb-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                onClick={() => {
                  if (resendTimer === 0 && !isResending) {
                    handleResendCode();
                  }
                }}
                disabled={resendTimer > 0 || isResending}
              >
                {isResending ? 'Resending...' : resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
              </button>
              <button
                type="button"
                className={`max-w-xs mx-auto w-full h-12 rounded-full font-semibold text-base mt-2 bg-gradient-to-r from-orange-400 to-yellow-400 text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-500 relative overflow-hidden flex items-center justify-center transition-transform duration-100 ${isBackToLoginPressed ? 'scale-95' : ''}`}
                onClick={() => { setShowPhoneScreen(false); setPhoneStep(0); setPhone(''); setPhoneError(''); setCode(['', '', '', '', '', '']); setCodeError(''); }}
                onPointerDown={() => setIsBackToLoginPressed(true)}
                onPointerUp={() => setIsBackToLoginPressed(false)}
                onPointerLeave={() => setIsBackToLoginPressed(false)}
                onTouchStart={() => setIsBackToLoginPressed(true)}
                onTouchEnd={() => setIsBackToLoginPressed(false)}
              >
                Back to Login
              </button>
            </div>
            {/* Submit code button at bottom */}
            <div className="fixed left-0 right-0 bottom-0 z-50 px-4 pt-3 pb-6 flex flex-col items-center" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }} role="group" aria-label="Phone code actions">
              <button
                type="button"
                aria-label="Verify code"
                className={`max-w-xs mx-auto w-full h-12 rounded-full font-semibold text-base bg-gradient-to-r from-orange-400 to-yellow-400 text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-500 relative overflow-hidden flex items-center justify-center transition-transform duration-100 ${isCodeSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={isCodeSubmitting || code.join('').length !== 6}
                onClick={async () => {
                  setCodeError('');
                  const codeStr = code.join('');
                  if (!/^\d{6}$/.test(codeStr)) {
                    setCodeError('Enter the 6-digit code');
                    return;
                  }
                  setIsCodeSubmitting(true);
                  setTimeout(() => {
                    setIsCodeSubmitting(false);
                    // Placeholder: success, go back to login
                    setShowPhoneScreen(false);
                    setPhoneStep(0);
                    setPhone('');
                    setCode(['', '', '', '', '', '']);
                    setCodeError('');
                  }, 1000);
                }}
              >
                {isCodeSubmitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Verify'}
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Main mobile login screen
  return (
    <div className="min-h-screen flex flex-col justify-end items-center bg-black relative">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/images/login-background.jpg)', filter: 'brightness(0.4)', backgroundColor: '#1a1a1a', zIndex: 0 }} />
      <div className="fixed bottom-0 left-0 right-0 h-screen z-7">
        <LinearBlur
          steps={3}
          strength={48}
          falloffPercentage={60}
          side="bottom"
          style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
        />
      </div>
      <div className="fixed inset-0 w-full h-full bg-gradient-to-t from-black via-black/40 via-transparent to-transparent z-6"></div>
      <div className="relative z-10 w-full max-w-sm mx-auto px-4 pb-8 flex flex-col items-center">
        <div className="w-full flex flex-col items-center">
          <h1 className="text-3xl font-bold text-white mb-2 w-full text-left pl-3">Welcome Back</h1>
          <p className="text-base text-gray-300 mb-8 w-full text-left pl-3">Sign in to your <span className="font-redressed text-xl text-orange-500">{siteName}</span> account</p>
          <button
            type="button"
            className={`w-full h-12 rounded-full font-semibold text-base bg-white text-black mb-3 flex items-center justify-center transition-transform duration-100 ${isGooglePressed ? 'scale-95' : ''}`}
            onClick={handleGoogleSignIn}
            disabled={isGoogleSubmitting}
            onPointerDown={() => setIsGooglePressed(true)}
            onPointerUp={() => setIsGooglePressed(false)}
            onPointerLeave={() => setIsGooglePressed(false)}
            onTouchStart={() => setIsGooglePressed(true)}
            onTouchEnd={() => setIsGooglePressed(false)}
          >
            {isGoogleSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 mr-2">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Sign in with Google
          </button>
          <button
            type="button"
            className={`w-full h-12 rounded-full font-semibold text-base bg-[#2d2320] text-white mb-3 flex items-center justify-center transition-transform duration-100 ${isEmailPressed ? 'scale-95' : ''}`}
            onClick={() => setShowEmail(true)}
            onPointerDown={() => setIsEmailPressed(true)}
            onPointerUp={() => setIsEmailPressed(false)}
            onPointerLeave={() => setIsEmailPressed(false)}
            onTouchStart={() => setIsEmailPressed(true)}
            onTouchEnd={() => setIsEmailPressed(false)}
          >
            <Mail className="h-5 w-5 mr-2" /> Sign in with email
          </button>
          <button
            type="button"
            className={`w-full h-12 rounded-full font-semibold text-base bg-[#2d2320] text-white flex items-center justify-center transition-transform duration-100 ${isPhonePressed ? 'scale-95' : ''}`}
            onClick={() => setShowPhoneScreen(true)}
            onPointerDown={() => setIsPhonePressed(true)}
            onPointerUp={() => setIsPhonePressed(false)}
            onPointerLeave={() => setIsPhonePressed(false)}
            onTouchStart={() => setIsPhonePressed(true)}
            onTouchEnd={() => setIsPhonePressed(false)}
          >
            <Smartphone className="h-5 w-5 mr-2" /> Sign in with phone number
          </button>
          <p className="text-sm text-gray-400 mt-8">Don't have an account? <button 
            onClick={() => router.push('/signup')}
            className="text-orange-500 hover:text-orange-600 font-bold transition-colors">Sign up</button></p>
        </div>
      </div>
    </div>
  );
} 