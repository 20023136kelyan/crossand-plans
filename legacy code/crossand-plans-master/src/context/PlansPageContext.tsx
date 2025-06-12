import React from 'react';

export interface PlansPageContextType {
  handleDeleteRequest: (planId: string, planName: string) => void;
  handleMarkAsCompleted: (planId: string, planName: string) => void;
  handleConfirmCompletion: (planId: string) => Promise<void>;
  isConfirmingCompletion: boolean;
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
  return (
    <PlansPageContext.Provider value={{ handleDeleteRequest, handleMarkAsCompleted, handleConfirmCompletion, isConfirmingCompletion }}>
      {children}
    </PlansPageContext.Provider>
  );
};