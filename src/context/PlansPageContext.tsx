import React from 'react';

export interface PlansPageContextType {
  handleDeleteRequest: (planId: string, planName: string) => void;
  handleMarkAsCompleted: (planId: string, planName: string) => void;
  handleConfirmCompletion: (planId: string) => Promise<void>;
  isConfirmingCompletion: boolean;
  showTimelineTags: boolean;
  toggleTimelineTags: () => void;
}

export const PlansPageContext = React.createContext<PlansPageContextType | undefined>(undefined);

export const usePlansPageContext = () => {
  const context = React.useContext(PlansPageContext);
  if (!context) {
    throw new Error("usePlansPageContext must be used within a PlansPageContextProvider");
  }
  return context;
};

export const PlansPageProvider: React.FC<{
  children: React.ReactNode;
  handleDeleteRequest: (planId: string, planName: string) => void;
  handleMarkAsCompleted: (planId: string, planName: string) => void;
  handleConfirmCompletion: (planId: string) => Promise<void>;
  isConfirmingCompletion: boolean;
}> = ({ children, handleDeleteRequest, handleMarkAsCompleted, handleConfirmCompletion, isConfirmingCompletion }) => {
  // Initialize timeline tags preference from localStorage or default to true
  const [showTimelineTags, setShowTimelineTags] = React.useState<boolean>(() => {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('showTimelineTags');
      return saved !== null ? saved === 'true' : true; // Default to true if not set
    }
    return true;
  });

  // Toggle timeline tags and save preference
  const toggleTimelineTags = React.useCallback(() => {
    setShowTimelineTags(prev => {
      const newValue = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('showTimelineTags', String(newValue));
      }
      return newValue;
    });
  }, []);

  return (
    <PlansPageContext.Provider value={{
      handleDeleteRequest,
      handleMarkAsCompleted,
      handleConfirmCompletion,
      isConfirmingCompletion,
      showTimelineTags,
      toggleTimelineTags
    }}>
      {children}
    </PlansPageContext.Provider>
  );
};