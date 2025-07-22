'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AuthPageWrapperProps {
  children: ReactNode;
}

export function AuthPageWrapper({ children }: AuthPageWrapperProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="auth-page-wrapper"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md space-y-8"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
} 