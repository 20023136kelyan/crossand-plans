'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

export function BottomNavFade() {
  const [isVisible, setIsVisible] = useState(true);
  const pathname = usePathname();

  // Paths that should not show the fade effect
  const excludePaths = ['/login', '/register', '/onboarding'];
  const shouldShowFade = !excludePaths.some(path => pathname.startsWith(path));
  
  useEffect(() => {
    // Function to handle scroll events
    const handleScroll = () => {
      const isAtBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 20;
      setIsVisible(!isAtBottom);
    };

    // Add scroll listener
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  if (!shouldShowFade) return null;

  return (
    <div 
      className={cn(
        "fixed bottom-16 left-0 right-0 z-30 pointer-events-none transition-opacity duration-200 md:hidden",
        isVisible ? "opacity-100" : "opacity-0"
      )} 
      style={{
        height: '80px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%)',
      }}
    />
  );
}
