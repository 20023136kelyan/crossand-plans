'use client';

import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UserLimits {
  maxPlansPerUser: number;
  maxParticipantsPerPlan: number;
  currentPlanCount: number;
  canCreatePlan: boolean;
  canAddParticipant: (currentParticipants: number) => boolean;
  getRemainingPlans: () => number;
  getRemainingParticipants: (currentParticipants: number) => number;
}

export function useLimits(): UserLimits {
  const { settings } = useSettings();
  const { user } = useAuth();
  const [currentPlanCount, setCurrentPlanCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const maxPlansPerUser = settings?.maxPlansPerUser || 50;
  const maxParticipantsPerPlan = settings?.maxParticipantsPerPlan || 20;

  useEffect(() => {
    if (!user?.uid) {
      setCurrentPlanCount(0);
      setLoading(false);
      return;
    }

    const fetchUserPlanCount = async () => {
      try {
        setLoading(true);
        const plansQuery = query(
          collection(db, 'plans'),
          where('createdBy', '==', user.uid)
        );
        const plansSnapshot = await getDocs(plansQuery);
        setCurrentPlanCount(plansSnapshot.size);
      } catch (error) {
        console.error('Error fetching user plan count:', error);
        setCurrentPlanCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchUserPlanCount();
  }, [user?.uid]);

  const canCreatePlan = currentPlanCount < maxPlansPerUser;
  
  const canAddParticipant = (currentParticipants: number): boolean => {
    return currentParticipants < maxParticipantsPerPlan;
  };

  const getRemainingPlans = (): number => {
    return Math.max(0, maxPlansPerUser - currentPlanCount);
  };

  const getRemainingParticipants = (currentParticipants: number): number => {
    return Math.max(0, maxParticipantsPerPlan - currentParticipants);
  };

  return {
    maxPlansPerUser,
    maxParticipantsPerPlan,
    currentPlanCount,
    canCreatePlan,
    canAddParticipant,
    getRemainingPlans,
    getRemainingParticipants,
  };
}

// Helper function to check file upload limits
export function useFileUploadLimits() {
  const { settings } = useSettings();
  
  const maxFileSize = (settings?.maxFileSize || 10) * 1024 * 1024; // Convert MB to bytes
  const allowedFileTypes = settings?.allowedFileTypes || ['jpg', 'jpeg', 'png', 'gif', 'pdf'];
  
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file size
    if (file.size > maxFileSize) {
      return {
        valid: false,
        error: `File size must be less than ${settings?.maxFileSize || 10}MB`
      };
    }
    
    // Check file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !allowedFileTypes.includes(fileExtension)) {
      return {
        valid: false,
        error: `File type not allowed. Allowed types: ${allowedFileTypes.join(', ')}`
      };
    }
    
    return { valid: true };
  };
  
  return {
    maxFileSize,
    allowedFileTypes,
    validateFile,
    maxFileSizeMB: settings?.maxFileSize || 10,
  };
}