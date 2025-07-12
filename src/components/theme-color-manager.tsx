'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

export function ThemeColorManager() {
  const { theme } = useTheme();

  useEffect(() => {
    // Get the theme-color meta tag
    let themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    
    // If it doesn't exist, create it
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.name = 'theme-color';
      document.head.appendChild(themeColorMeta);
    }

    // Update the theme color based on current theme
    if (theme === 'dark') {
      themeColorMeta.content = '#0a0a0b'; // Dark mode background
    } else {
      themeColorMeta.content = '#f5f3f0'; // Light mode background
    }
  }, [theme]);

  return null; // This component doesn't render anything
} 