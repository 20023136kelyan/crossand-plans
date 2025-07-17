import { PhoneAuthForm } from '@/components/auth/PhoneAuthForm';
import { AuthPageWrapper } from '@/components/auth/shared/AuthPageWrapper';

export default function PhoneLoginPage() {
  return (
    <AuthPageWrapper>
      <PhoneAuthForm />
    </AuthPageWrapper>
  );
} 