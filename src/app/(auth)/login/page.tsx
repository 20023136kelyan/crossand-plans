'use client';

import { LoginForm } from '@/components/auth/LoginForm';
import LoginFormMobile from '@/components/auth/LoginFormMobile';
import { AuthPageWrapper } from '@/components/auth/shared/AuthPageWrapper';
import { useIsMobile } from '@/hooks/use-is-mobile';

export default function LoginPage() {
  const isMobile = useIsMobile();
  return (
    <AuthPageWrapper>
      {isMobile ? <LoginFormMobile /> : <LoginForm />}
    </AuthPageWrapper>
  );
}
