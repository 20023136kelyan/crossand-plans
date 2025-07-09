'use client';

import React, { useEffect, useRef } from 'react';

interface PlanTitleWrapperProps {
  title: string;
  className?: string;
}

export const PlanTitleWrapper: React.FC<PlanTitleWrapperProps> = ({ title, className = '' }) => {
  const titleRef = useRef<HTMLSpanElement>(null);
  
  useEffect(() => {
    const element = titleRef.current;
    if (!element) return;
    
    // Function to ensure at least two words on second line
    const optimizeWrapping = () => {
      // Reset content first to measure natural wrapping
      element.innerHTML = title;
      
      // Give the browser a moment to calculate layout
      setTimeout(() => {
        const words = title.split(' ');
        if (words.length <= 3) return; // Not enough words to worry about
        
        const rect = element.getBoundingClientRect();
        const originalHeight = rect.height;
        
        // If title takes up only one line, no need to optimize
        if (originalHeight <= 24) return; // Assuming ~20px line height
        
        // Try different combinations to find optimal wrapping
        let bestHTML = title;
        
        // Try inserting non-breaking spaces between different pairs of words
        for (let i = 1; i < words.length - 2; i++) {
          // Join words with regular spaces except between i and i+1
          const testTitle = [
            ...words.slice(0, i),
            words[i] + '&nbsp;' + words[i+1],
            ...words.slice(i+2)
          ].join(' ');
          
          element.innerHTML = testTitle;
          
          // Check if we have at least two words on second line now
          const newRect = element.getBoundingClientRect();
          if (newRect.height === originalHeight) {
            bestHTML = testTitle;
            break;
          }
        }
        
        // Apply the best wrapping
        element.innerHTML = bestHTML;
      }, 0);
    };
    
    optimizeWrapping();
    
    // Re-run on resize
    const resizeObserver = new ResizeObserver(optimizeWrapping);
    resizeObserver.observe(element.parentElement as Element);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [title]);

  return (
    <span 
      ref={titleRef} 
      className={`inline-block w-full ${className}`}
      style={{
        wordBreak: 'break-word',
        hyphens: 'auto',
      }}
    >
      {title}
    </span>
  );
};
