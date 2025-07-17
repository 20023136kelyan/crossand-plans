'use client';

import { SignupForm } from '@/components/auth/SignupForm';
import { EmailVerificationPrompt } from '@/components/auth/EmailVerificationPrompt';
import { useSearchParams } from 'next/navigation';

export default function SignupPage() {
  const searchParams = useSearchParams();
  const showVerification = searchParams.get('verify') === '1';
  const email = searchParams.get('email') || '';

  if (showVerification && email) {
    return <EmailVerificationPrompt email={email} />;
  }
  return <SignupForm />;
}
