'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  current: boolean;
}

interface OnboardingProgressProps {
  steps: OnboardingStep[];
  className?: string;
}

export function OnboardingProgress({ steps, className }: OnboardingProgressProps) {
  const currentStep = steps.find(step => step.current);
  
  return (
    <div className={cn('w-full', className)}>
      {/* Current Step Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          {currentStep?.title || 'Setup Progress'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {currentStep?.description || 'Complete your profile setup'}
        </p>
      </div>
      
      {/* Segmented Progress Bar */}
      <div className="flex gap-1 mb-6">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              'flex-1 h-2 rounded-full transition-all duration-300 ease-in-out',
              step.completed
                ? 'bg-primary'
                : step.current
                ? 'bg-primary/50'
                : 'bg-secondary'
            )}
          />
        ))}
      </div>

      {/* Completion Message */}
      {steps.every(step => step.completed) && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <Check className="w-5 h-5 text-green-600 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-green-800">
                Setup Complete!
              </h3>
              <p className="text-sm text-green-700 mt-1">
                You've successfully completed all onboarding steps.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Helper function to create onboarding steps
export function createOnboardingSteps(currentStep: string, completedSteps: string[]): OnboardingStep[] {
  const allSteps = [
    {
      id: 'email-verification',
      title: 'Verify Email',
      description: 'Confirm your email address to secure your account'
    },
    {
      id: 'basic-info',
      title: 'Basic Information',
      description: 'Tell us about yourself and your role'
    },
    {
      id: 'preferences',
      title: 'Preferences',
      description: 'Customize your experience and notifications'
    },
    {
      id: 'team-setup',
      title: 'Team Setup',
      description: 'Invite team members and set up collaboration'
    }
  ];

  return allSteps.map(step => ({
    ...step,
    completed: completedSteps.includes(step.id),
    current: step.id === currentStep
  }));
}