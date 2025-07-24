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
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [hasCompleted, setHasCompleted] = React.useState(false);

  // Function to complete the typing animation immediately
  const completeTyping = React.useCallback(() => {
    setDisplayedText(text);
    setCurrentIndex(text.length);
    setHasCompleted(true);
    if (onComplete) {
      onComplete();
    }
  }, [text, onComplete]);

  // Handle click on the speech bubble
  const handleBubbleClick = () => {
    if (isTyping && currentIndex < text.length) {
      completeTyping();
    }
  };

  React.useEffect(() => {
    if (isTyping) {
      setDisplayedText('');
      setCurrentIndex(0);
      setHasCompleted(false);
      
      const interval = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= text.length) {
            clearInterval(interval);
            setHasCompleted(true);
            if (onComplete) {
              onComplete();
            }
            return prev;
          }
          setDisplayedText(text.slice(0, prev + 1));
          return prev + 1;
        });
      }, typingSpeed);
      
      return () => clearInterval(interval);
    } else {
      setDisplayedText(text);
      setCurrentIndex(text.length);
      setHasCompleted(false);
    }
  }, [text, isTyping, typingSpeed, onComplete]);

  // Call onComplete after the component has rendered
  React.useEffect(() => {
    if (hasCompleted && onComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [hasCompleted, onComplete]);

  return (
    <motion.div
      variants={speechBubbleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={handleBubbleClick}
      className="bg-white rounded-2xl p-6 shadow-lg max-w-md mx-auto relative cursor-pointer hover:bg-gray-50 transition-colors"
    >
      <div className="text-gray-800 text-lg leading-relaxed">
        {isTyping ? (
          <span>
            {displayedText}
            <span className="animate-pulse">|</span>
          </span>
        ) : (
          displayedText
        )}
      </div>
      
      {children}
    </motion.div>
  );
}; 