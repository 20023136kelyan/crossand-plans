"use client";

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface BalancedTextProps {
  text: string;
  className?: string;
  maxLines?: number;
  minCharsPerLine?: number;
  title?: string;
}

export function BalancedText({ 
  text, 
  className, 
  maxLines = 2, 
  minCharsPerLine = 12,
  title
}: BalancedTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayText, setDisplayText] = useState(text);
  
  useEffect(() => {
    function balanceText() {
      if (!containerRef.current) return;
      
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const words = text.split(' ');
      
      // Reset to full text to measure
      container.textContent = text;
      
      // Calculate if text will overflow into multiple lines
      const singleLineHeight = parseInt(window.getComputedStyle(container).lineHeight);
      const containerHeight = container.offsetHeight;
      const lineCount = Math.round(containerHeight / singleLineHeight);
      
      // If within a single line or already truncated properly, keep full text
      if (lineCount <= 1 || displayText !== text) {
        return;
      }
      
      // If we'll have multiple lines, ensure we don't have orphaned words
      const charsPerLine = Math.floor(containerWidth / (parseInt(window.getComputedStyle(container).fontSize) * 0.6));
      
      if (lineCount >= maxLines) {
        // Calculate approximate truncation point
        const totalChars = charsPerLine * (maxLines - 0.5); // Leave space for ellipsis
        if (text.length > totalChars) {
          // Find last space before truncation point
          const lastSpaceBeforeCut = text.lastIndexOf(' ', totalChars);
          if (lastSpaceBeforeCut > minCharsPerLine) {
            setDisplayText(text.substring(0, lastSpaceBeforeCut) + '...');
          }
        }
      }
    }
    
    if (typeof window !== 'undefined') {
      balanceText();
      window.addEventListener('resize', balanceText);
      return () => window.removeEventListener('resize', balanceText);
    }
  }, [text, maxLines, minCharsPerLine, displayText]);
  
  return (
    <div 
      ref={containerRef}
      className={cn('line-clamp-2 [text-wrap:balance]', className)}
      title={title || text}
      style={{ 
        WebkitLineClamp: maxLines, 
        display: '-webkit-box', 
        WebkitBoxOrient: 'vertical', 
        overflow: 'hidden'
      }}
    >
      {displayText}
    </div>
  );
}
