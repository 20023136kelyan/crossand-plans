import React from 'react';
import { motion } from 'framer-motion';

interface CroissantCharacterProps {
  mood: 'idle' | 'excited' | 'thinking';
  size?: 'sm' | 'md' | 'lg';
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
  sm: 'w-16 h-16 text-2xl',
  md: 'w-24 h-24 text-4xl',
  lg: 'w-32 h-32 text-6xl'
};

export const CroissantCharacter: React.FC<CroissantCharacterProps> = ({ 
  mood, 
  size = 'md' 
}) => {
  return (
    <motion.div
      variants={croissantVariants}
      animate={mood}
      className="flex items-center justify-center"
    >
      <div className={`${sizeClasses[size]} bg-gradient-to-br from-amber-300 to-orange-400 rounded-full flex items-center justify-center shadow-lg border-4 border-white`}>
        <span className="drop-shadow-sm">🥐</span>
      </div>
    </motion.div>
  );
}; 