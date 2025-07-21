import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface CroissantCharacterProps {
  mood: 'idle' | 'excited' | 'thinking';
  size?: 'sm' | 'md' | 'lg';
  reaction?: string;
  showReaction?: boolean;
}

const croissantVariants = {
  idle: { 
    rotate: [0, -2, 2, 0],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const }
  },
  excited: { 
    scale: [1, 1.1, 1],
    rotate: [0, 5, -5, 0],
    transition: { duration: 0.5 }
  },
  thinking: {
    rotate: [0, -5, 5, 0],
    transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" as const }
  }
};

const sizeClasses = {
  sm: 'w-20 h-20',
  md: 'w-32 h-32',
  lg: 'w-40 h-40'
};

// Map moods to Crossy images
const moodImages = {
  idle: '/images/crossy_idle.png',
  excited: '/images/crossy_excited.png',
  thinking: '/images/crossy_talking.png'
};

// Additional image mappings for more variety
const getMoodImage = (mood: 'idle' | 'excited' | 'thinking') => {
  const baseImages = {
    idle: '/images/crossy_idle.png',
    excited: '/images/crossy_excited.png',
    thinking: '/images/crossy_talking.png'
  };
  
  // Add some randomness to make it more dynamic
  const random = Math.random();
  
  if (mood === 'idle') {
    // Use idle, stoic, or wink for idle state
    if (random < 0.6) return '/images/crossy_idle.png';
    if (random < 0.8) return '/images/crossy_stoic.png';
    return '/images/crossy_wink.png';
  }
  
  if (mood === 'excited') {
    // Use excited, talking variants, or catface for excited state
    if (random < 0.4) return '/images/crossy_excited.png';
    if (random < 0.6) return '/images/crossy_talking.png';
    if (random < 0.8) return '/images/crossy_talking_2.png';
    return '/images/crossy_catface.png';
  }
  
  if (mood === 'thinking') {
    // Use talking variants for thinking state
    if (random < 0.5) return '/images/crossy_talking.png';
    if (random < 0.75) return '/images/crossy_talking_2.png';
    return '/images/crossy_talking_3.png';
  }
  
  return baseImages[mood];
};

export const CroissantCharacter: React.FC<CroissantCharacterProps> = ({ 
  mood, 
  size = 'md',
  reaction,
  showReaction = false
}) => {
  return (
    <motion.div
      variants={croissantVariants}
      animate={mood}
      className="flex items-center justify-center relative"
    >
      <div className={`${sizeClasses[size]} bg-gradient-to-br from-amber-300 to-orange-400 rounded-full flex items-center justify-center shadow-lg border-4 border-white overflow-hidden`}>
        <Image
          src={getMoodImage(mood)}
          alt={`Crossy ${mood}`}
          width={size === 'sm' ? 80 : size === 'md' ? 128 : 160}
          height={size === 'sm' ? 80 : size === 'md' ? 128 : 160}
          className="object-cover"
          priority
        />
      </div>
      
      {/* Reaction Speech Bubble */}
      {showReaction && reaction && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-white rounded-lg px-3 py-2 shadow-lg border-2 border-orange-200 z-10"
        >
          <div className="text-sm font-medium text-gray-800 text-center">
            {reaction}
          </div>
          {/* Speech bubble tail */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
        </motion.div>
      )}
    </motion.div>
  );
}; 