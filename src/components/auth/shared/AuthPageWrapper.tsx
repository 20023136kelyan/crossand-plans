'use client';

import { ReactNode } from 'react';

interface AuthPageWrapperProps {
  children: ReactNode;
}

export function AuthPageWrapper({ children }: AuthPageWrapperProps) {
  return (
    <div className="w-full max-w-md space-y-8">
      {children}
    </div>
  );
} 