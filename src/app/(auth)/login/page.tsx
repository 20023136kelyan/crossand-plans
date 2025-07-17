'use client';

import { LoginForm } from '@/components/auth/LoginForm';
import { AuthPageWrapper } from '@/components/auth/shared/AuthPageWrapper';

export default function LoginPage() {
  return (
    <AuthPageWrapper>
      <LoginForm />
    </AuthPageWrapper>
  );
}
