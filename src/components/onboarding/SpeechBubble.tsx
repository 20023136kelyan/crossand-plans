import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SpeechBubbleProps {
  text: string;
  isTyping: boolean;
  typingSpeed: number;
  children?: React.ReactNode;
  onComplete?: () => void;
}

const speechBubbleVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.8 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.8 }
};

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  text,
  isTyping,
  typingSpeed,
  children,
  onComplete
}) => {
  const [displayedText, setDisplayedText] = React.useState('');
  const [isComplete, setIsComplete] = React.useState(false);
  const animationRef = React.useRef<number>();
  const completionCalledRef = React.useRef(false);
  const startTimeRef = React.useRef<number>(0);
  const frameRef = React.useRef<number>();

  // Function to complete the typing animation immediately
  const completeTyping = React.useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }
    
    setDisplayedText(text);
    setIsComplete(true);
    
    if (onComplete && !completionCalledRef.current) {
      completionCalledRef.current = true;
      // Use requestAnimationFrame to ensure this runs after render
      requestAnimationFrame(() => {
        onComplete();
      });
    }
  }, [text, onComplete]);

  const handleBubbleClick = React.useCallback(() => {
    if (isTyping && !isComplete) {
      completeTyping();
    }
  }, [isTyping, isComplete, completeTyping]);

  // Animation frame based typing effect
  const animateTyping = React.useCallback((timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const elapsed = timestamp - startTimeRef.current;
    const charsToShow = Math.min(
      Math.floor(elapsed / typingSpeed),
      text.length
    );

    if (charsToShow <= text.length) {
      setDisplayedText(text.slice(0, charsToShow));
    }

    if (charsToShow < text.length) {
      frameRef.current = requestAnimationFrame(animateTyping);
    } else if (!isComplete) {
      setIsComplete(true);
      if (onComplete && !completionCalledRef.current) {
        completionCalledRef.current = true;
        requestAnimationFrame(() => {
          onComplete();
        });
      }
    }
  }, [text, typingSpeed, isComplete, onComplete]);

  React.useEffect(() => {
    if (isTyping) {
      setDisplayedText('');
      setIsComplete(false);
      completionCalledRef.current = false;
      startTimeRef.current = 0;
      
      if (typingSpeed > 0) {
        frameRef.current = requestAnimationFrame(animateTyping);
      } else {
        completeTyping();
      }

      return () => {
        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = undefined;
        }
      };
    } else {
      setDisplayedText(text);
      setIsComplete(true);
    }
  }, [text, isTyping, typingSpeed, animateTyping, completeTyping]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <motion.div
      variants={speechBubbleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={handleBubbleClick}
      className="bg-white rounded-2xl p-6 shadow-lg max-w-md mx-auto relative cursor-pointer hover:bg-gray-50 transition-colors"
    >
      <div className="text-gray-800 text-lg leading-relaxed whitespace-pre-line">
        {isTyping && !isComplete ? (
          <>
            {displayedText}
            <span className="animate-pulse">|</span>
          </>
        ) : (
          text
        )}
      </div>
      
      {children}
    </motion.div>
  );
}; 