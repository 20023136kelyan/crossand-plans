'use client';

import { SignupForm } from '@/components/auth/SignupForm';
import SignupFormMobile from '@/components/auth/SignupFormMobile';
import { EmailVerificationPrompt } from '@/components/auth/EmailVerificationPrompt';
import { EmailVerificationPromptMobile } from '@/components/auth/EmailVerificationPromptMobile';
import { useSearchParams } from 'next/navigation';
import { useIsMobile } from '@/hooks/use-is-mobile';

export default function SignupPage() {
  const searchParams = useSearchParams();
  const showVerification = searchParams.get('verify') === '1';
  const email = searchParams.get('email') || '';
  const isMobile = useIsMobile();

  if (showVerification && email) {
    return isMobile ? <EmailVerificationPromptMobile email={email} /> : <EmailVerificationPrompt email={email} />;
  }
  
  return isMobile ? <SignupFormMobile /> : <SignupForm />;
}
