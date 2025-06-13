'use client';

import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect, useCallback, useMemo } from 'react';
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

  // Memoize the fetch function to prevent unnecessary re-creation
  const fetchUserPlanCount = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      
      if (!db) {
        console.error('Firestore database not available');
        setCurrentPlanCount(0);
        return;
      }
      
      const plansQuery = query(
        collection(db, 'plans'),
        where('createdBy', '==', userId)
      );
      const plansSnapshot = await getDocs(plansQuery);
      setCurrentPlanCount(plansSnapshot.size);
    } catch (error) {
      console.error('Error fetching user plan count:', error);
      setCurrentPlanCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setCurrentPlanCount(0);
      setLoading(false);
      return;
    }

    fetchUserPlanCount(user.uid);
  }, [user?.uid, fetchUserPlanCount]);

  // Memoize computed values to prevent unnecessary recalculations
  const computedValues = useMemo(() => {
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
      canCreatePlan,
      canAddParticipant,
      getRemainingPlans,
      getRemainingParticipants,
    };
  }, [currentPlanCount, maxPlansPerUser, maxParticipantsPerPlan]);

  return {
    maxPlansPerUser,
    maxParticipantsPerPlan,
    currentPlanCount,
    ...computedValues,
  };
}

// Helper function to check file upload limits
export function useFileUploadLimits() {
  const { settings } = useSettings();
  
  // Memoize the validation function
  const validateFile = useCallback(async (file: File): Promise<{ valid: boolean; error?: string }> => {
    const { validateFile: centralizedValidate } = await import('@/lib/fileValidation');
    
    // Use settings-based limits if available, otherwise use centralized defaults
    const customSizeLimit = settings?.maxFileSize ? settings.maxFileSize * 1024 * 1024 : undefined;
    const customFormats = settings?.allowedFileTypes;
    
    const result = centralizedValidate(file, {
      type: 'general_upload',
      allowedFormats: 'all',
      customSizeLimit,
      customFormats
    });
    
    return {
       valid: result.valid,
       error: result.error
     };
   }, [settings?.maxFileSize, settings?.allowedFileTypes]);
   
   // Memoize computed values
   const limits = useMemo(() => ({
     maxFileSize: settings?.maxFileSize ? settings.maxFileSize * 1024 * 1024 : 10 * 1024 * 1024,
     allowedFileTypes: settings?.allowedFileTypes || ['jpg', 'jpeg', 'png', 'gif', 'pdf'],
     maxFileSizeMB: settings?.maxFileSize || 10,
   }), [settings?.maxFileSize, settings?.allowedFileTypes]);
   
   return {
     ...limits,
     validateFile,
   };
}