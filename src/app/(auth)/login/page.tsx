import { LoginForm } from '@/components/auth/LoginForm';
// Removed Users icon and Link for Macaroom, as it will be in LoginForm
// import { Users } from 'lucide-react';
// import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="w-full max-w-md space-y-8">
      {/* The MacaronLogo and app name Link previously here is now removed. */}
      {/* It will be rendered by the LoginForm component. */}
      <LoginForm />
    </div>
  );
}
