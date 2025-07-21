
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { completeOnboardingAction } from '@/app/actions/userActions';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Loader2, Save, LogOut, Heart, Activity, Users, MapPin, Phone, Mail, Globe, Calendar, Utensils, Car, Users as UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { CroissantCharacter } from '@/components/onboarding/CroissantCharacter';
import { SpeechBubble } from '@/components/onboarding/SpeechBubble';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Animation variants
const inputVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 }
};

// Travel Tolerance Slider Component
const TravelToleranceSlider = ({ 
  sliderValue, 
  setSliderValue, 
  handleResponse, 
  currentQuestion 
}: {
  sliderValue: number;
  setSliderValue: (value: number) => void;
  handleResponse: (response: any) => void;
  currentQuestion: Question;
}) => {
  return (
    <motion.div variants={inputVariants} initial="hidden" animate="visible" exit="exit" className="mt-4">
      <div className="relative max-w-md mx-auto">
        {/* Slider Container */}
        <div className="relative mb-6">
          {/* Animated Car on Slider */}
          <motion.div
            animate={{ 
              x: `${Math.max(5, Math.min(95, (sliderValue / 4) * 90 + 5))}%`,
              rotate: [0, 1, -1, 0]
            }}
            transition={{ 
              x: { duration: 0.3, ease: "easeOut" },
              rotate: { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
            }}
            className="absolute -top-4 text-3xl z-20 cursor-grab active:cursor-grabbing"
            style={{ 
              left: `${Math.max(5, Math.min(95, (sliderValue / 4) * 90 + 5))}%`,
              transform: 'translateX(-50%)'
            }}
            whileHover={{
              scale: 1.1,
              transition: { duration: 0.2 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0}
            dragMomentum={false}
            onDrag={(event, info) => {
              const sliderWidth = 90; // 90% of container width
              const dragPercentage = (info.point.x / window.innerWidth) * 100;
              const clampedPercentage = Math.max(5, Math.min(95, dragPercentage));
              const newSliderValue = Math.round(((clampedPercentage - 5) / sliderWidth) * 4);
              setSliderValue(Math.max(0, Math.min(4, newSliderValue)));
            }}
            onAnimationComplete={() => {
              // Add bounce effect when reaching edges
              if (sliderValue === 0 || sliderValue === 4) {
                // Small bounce animation
                setTimeout(() => {
                  // This will trigger a small bounce effect
                }, 100);
              }
            }}
          >
            <span style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>🚗</span>
            {/* Smoke Animation */}
            <motion.div
              animate={{ 
                opacity: [0, 1, 0],
                y: [0, -10],
                x: [0, -5]
              }}
              transition={{ 
                duration: 1,
                repeat: Infinity,
                delay: 0.2
              }}
              className="absolute top-0 -left-2 text-sm z-10"
            >
              <span style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>💨</span>
            </motion.div>
            <motion.div
              animate={{ 
                opacity: [0, 1, 0],
                y: [0, -8],
                x: [0, -3]
              }}
              transition={{ 
                duration: 1.2,
                repeat: Infinity,
                delay: 0.4
              }}
              className="absolute top-1 -left-1 text-xs z-10"
            >
              <span style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>💨</span>
            </motion.div>
          </motion.div>
          
          {/* Slider */}
          <div className="relative w-full">
            {/* Background Track */}
            <div className="w-full h-3 bg-gray-200 rounded-lg"></div>
            {/* Fill Track */}
            <div 
              className="absolute top-0 h-3 bg-orange-400 rounded-lg transition-all duration-300"
              style={{ width: `${(sliderValue / 4) * 100}%` }}
            ></div>
            {/* Slider Input */}
            <input
              type="range"
              min="0"
              max="4"
              value={sliderValue}
              className="absolute top-0 w-full h-3 appearance-none cursor-pointer slider opacity-0 z-10"
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setSliderValue(value);
              }}
            />
          </div>
        </div>
        
        {/* Slider Labels */}
        <div className="flex justify-between mt-2 text-xs text-gray-600">
          <span>Walking</span>
          <span>30 min</span>
          <span>1 hour</span>
          <span>2 hours</span>
          <span>Any distance</span>
        </div>
        
        {/* Continue Button */}
        <div className="mt-4 flex justify-center">
              <button
            onClick={() => {
              const options = currentQuestion.options || [];
              const selectedOption = options[sliderValue];
              if (selectedOption) {
                handleResponse(selectedOption);
              }
            }}
            className="bg-orange-400 text-white hover:bg-orange-500 px-6 py-2 rounded-full text-sm font-medium transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            Continue
              </button>
        </div>
      </div>
    </motion.div>
  );
};

// Interaction Level Selector Component
const InteractionLevelSelector = ({ 
  handleResponse, 
  currentQuestion 
}: {
  handleResponse: (response: any) => void;
  currentQuestion: Question;
}) => {
  const [selectedAnimal, setSelectedAnimal] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState<string | null>(null);

  const animals = [
    {
      emoji: '🐢',
      name: 'Shy Turtle',
      description: 'Mostly observing',
      animation: { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] },
      reactions: ['💚', '🌿', '🍃', '🌱', '💚', '🌿']
    },
    {
      emoji: '🐬',
      name: 'Friendly Dolphin',
      description: 'Balanced interaction',
      animation: { scale: [1, 1.1, 1], y: [0, -10, 0] },
      reactions: ['💙', '🌊', '💧', '🐳', '💙', '🌊']
    },
    {
      emoji: '🐧',
      name: 'Party Penguin',
      description: 'Very social and talkative',
      animation: { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] },
      reactions: ['🎉', '🎊', '🎈', '🎪', '🎉', '🎊']
    },
    {
      emoji: '🦎',
      name: 'Adaptive Chameleon',
      description: 'I adapt to the situation',
      animation: { scale: [1, 1.1, 1], backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'] },
      reactions: ['🌈', '✨', '🌟', '💫', '🌈', '✨']
    }
  ];

  const handleAnimalSelect = (animal: any) => {
    setSelectedAnimal(animal.name);
    setShowReactions(animal.name);
    
    setTimeout(() => {
      handleResponse(`${animal.emoji} ${animal.name} - ${animal.description}`);
    }, 1000);
  };

  return (
    <motion.div variants={inputVariants} initial="hidden" animate="visible" exit="exit" className="mt-4">
      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
        {animals.map((animal, index) => (
          <motion.button
            key={animal.name}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: 1, 
              scale: selectedAnimal === animal.name ? animal.animation.scale : 1,
              rotate: selectedAnimal === animal.name ? animal.animation.rotate : 0,
              y: selectedAnimal === animal.name ? animal.animation.y : 0
            }}
            transition={{ 
              delay: index * 0.1, 
              duration: selectedAnimal === animal.name ? 0.5 : 0.3,
              repeat: selectedAnimal === animal.name ? Infinity : 0,
              ease: "easeInOut"
            }}
            whileHover={{ 
              scale: 1.05,
              transition: { duration: 0.2 }
            }}
            whileTap={{ scale: 0.95 }}
            className={`relative p-4 rounded-lg border-2 transition-all duration-200 text-center ${
              selectedAnimal === animal.name
                ? 'border-orange-400 bg-orange-50 shadow-lg scale-105'
                : 'border-gray-300 bg-white hover:border-orange-300 hover:shadow-md'
            }`}
            onClick={() => handleAnimalSelect(animal)}
          >
            <div className="text-4xl mb-2">{animal.emoji}</div>
            <div className="font-semibold text-sm text-gray-800">{animal.name}</div>
            <div className="text-xs text-gray-600 mt-1">{animal.description}</div>
            
            {/* Emoji Reactions */}
            {showReactions === animal.name && (
              <div className="absolute inset-0 pointer-events-none">
                {animal.reactions.map((reaction, reactionIndex) => (
                  <motion.div
                    key={reactionIndex}
                    initial={{ 
                      opacity: 0, 
                      scale: 0,
                      x: 0,
                      y: 0
                    }}
                    animate={{ 
                      opacity: [0, 1, 0],
                      scale: [0, 1.5, 0],
                      x: [
                        0,
                        (Math.random() - 0.5) * 100,
                        (Math.random() - 0.5) * 150
                      ],
                      y: [
                        0,
                        -50 - Math.random() * 50,
                        -100 - Math.random() * 100
                      ]
                    }}
                    transition={{ 
                      duration: 1.5,
                      delay: reactionIndex * 0.1,
                      ease: "easeOut"
                    }}
                    className="absolute text-2xl"
                    style={{
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    {reaction}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

// Question types
type QuestionType = 
  | 'welcome'
  | 'name'
  | 'ready'
  | 'birthDate'
  | 'allergies'
  | 'dietary'
  | 'cuisines'
  | 'physicalLimitations'
  | 'activityPreferences'
  | 'travelTolerance'
  | 'interactionLevel'
  | 'almostDone'
  | 'complete';

interface Question {
  id: QuestionType;
  text: string;
  type: 'text' | 'select' | 'multiSelect' | 'date' | 'button';
  options?: string[];
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  response?: string;
  buttonText?: string;
}

const questions: Question[] = [
  {
    id: 'welcome',
    text: "Bonjour! I am Crossy, your flaky guide to this buttery adventure! 🥐",
    type: 'button',
    buttonText: "Nice to meet you! 👋"
  },
  {
    id: 'name',
    text: "But before we begin, tell me—what should I call you?",
    type: 'text',
    placeholder: "Enter your name...",
    required: true,
    maxLength: 50
  },
  {
    id: 'ready',
    text: "Perfect! Now let's get to know you better so I can recommend the best experiences for you! 🎯",
    type: 'button',
    buttonText: "I'm ready! 🚀"
  },
  {
    id: 'birthDate',
    text: "When's your special day? (This helps us personalize your experience!)",
    type: 'date'
  },
  {
    id: 'allergies',
    text: "Any food allergies I should know about? Safety first! 🚫",
    type: 'multiSelect',
    options: ['🥜 Peanuts', '🌰 Tree Nuts', '🥛 Milk', '🥚 Eggs', '🫘 Soy', '🌾 Wheat', '🐟 Fish', '🦐 Shellfish', '🌾 Gluten', '🥛 Lactose', '🍷 Sulfites', '❌ None']
  },
  {
    id: 'dietary',
    text: "What's your dietary style? Let's make sure we find the perfect places for you! 🥗",
    type: 'multiSelect',
    options: ['🥬 Vegetarian', '🌱 Vegan', '🐟 Pescatarian', '🥩 Keto', '🦴 Paleo', '🫒 Mediterranean', '🍞 Low-Carb', '🥛 Dairy-Free', '🌾 Gluten-Free', '☪️ Halal', '✡️ Kosher', '❌ None']
  },
  {
    id: 'cuisines',
    text: "What cuisines make your taste buds dance? 🍜",
    type: 'multiSelect',
    options: ['🍝 Italian', '🌮 Mexican', '🥢 Chinese', '🍱 Japanese', '🍜 Thai', '🍛 Indian', '🥖 French', '🫒 Mediterranean', '🍔 American', '🍚 Korean', '🍜 Vietnamese', '🧀 Greek', '🥘 Spanish', '🥙 Lebanese', '🍽️ Ethiopian', '🫓 Moroccan']
  },
  {
    id: 'physicalLimitations',
    text: "Any physical considerations I should keep in mind for your adventures? ⚠️",
    type: 'multiSelect',
    options: ['♿ Wheelchair Accessible', '🚶 Limited Mobility', '👁️ Visual Impairment', '👂 Hearing Impairment', '🐕 Service Animal Friendly', '🫂 Low-Impact Activities', '❌ None']
  },
  {
    id: 'activityPreferences',
    text: "What types of activities get you excited? ❤️",
    type: 'multiSelect',
    options: ['🏔️ Outdoor Adventures', '🏛️ Cultural Experiences', '🍽️ Food & Dining', '🎭 Arts & Entertainment', '💪 Sports & Fitness', '🧘 Relaxation & Wellness', '🛍️ Shopping', '📚 Educational', '🎉 Social Events', '📸 Photography', '🎵 Music', '🌿 Nature']
  },
  {
    id: 'travelTolerance',
    text: "How far are you willing to travel for a great experience?",
    type: 'select',
    options: ['Walking distance only', 'Up to 30 minutes', 'Up to 1 hour', 'Up to 2 hours', 'Any distance for the right experience', 'I prefer local adventures']
  },
  {
    id: 'interactionLevel',
    text: "How do you like to interact with others? Choose your spirit animal! 🦁",
    type: 'select',
    options: ['🐢 Shy Turtle - Mostly observing', '🐬 Friendly Dolphin - Balanced interaction', '🐧 Party Penguin - Very social and talkative', '🦎 Adaptive Chameleon - I adapt to the situation']
  },
  {
    id: 'almostDone',
    text: "Fantastic! I'm getting a really good sense of who you are. Just a few more details and we'll be all set! ✨",
    type: 'button',
    buttonText: "Almost there! 💪"
  },
  {
    id: 'complete',
    text: "Magnifique! You're all set for your buttery adventure! 🎉",
    type: 'button',
    buttonText: "Let's start planning! 🚀"
  }
];

const onboardingFormSchema = z.object({
  name: z.string().min(1, "Name is required.").max(100).optional().nullable(),
  birthDate: z.string().optional().nullable(),
  allergies: z.array(z.string()).optional().default([]),
  dietaryRestrictions: z.array(z.string()).optional().default([]),
  favoriteCuisines: z.array(z.string()).optional().default([]),
  physicalLimitations: z.array(z.string()).optional().default([]),
  activityTypePreferences: z.array(z.string()).optional().default([]),
  activityTypeDislikes: z.array(z.string()).optional().default([]),
  environmentalSensitivities: z.array(z.string()).optional().default([]),
  travelTolerance: z.string().optional().nullable(),
  budgetFlexibilityNotes: z.string().max(300).optional().nullable(),
  socialPreferences: z.object({
    preferredGroupSize: z.string().optional().nullable(),
    interactionLevel: z.string().optional().nullable(),
  }).optional().nullable(),
  availabilityNotes: z.string().max(500).optional().nullable(),
});

type OnboardingFormValues = z.infer<typeof onboardingFormSchema>;

export default function OnboardingPage() {
  const { user, loading: authLoading, currentUserProfile, acknowledgeNewUserWelcome, refreshProfileStatus, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [croissantMood, setCroissantMood] = useState<'idle' | 'excited' | 'thinking'>('idle');
  const [sliderValue, setSliderValue] = useState(2);
  const [crossyReaction, setCrossyReaction] = useState<string>('');
  const [showCrossyReaction, setShowCrossyReaction] = useState(false);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingFormSchema),
    defaultValues: {
      name: currentUserProfile?.name || user?.displayName || '',
      birthDate: currentUserProfile?.birthDate && typeof currentUserProfile.birthDate !== 'string' && typeof (currentUserProfile.birthDate as any)?.toDate === 'function'
        ? (currentUserProfile.birthDate as any).toDate().toISOString().split('T')[0]
        : (typeof currentUserProfile?.birthDate === 'string' ? currentUserProfile.birthDate.split('T')[0] : ''),
      allergies: currentUserProfile?.allergies || [],
      dietaryRestrictions: currentUserProfile?.dietaryRestrictions || [],
      favoriteCuisines: currentUserProfile?.favoriteCuisines || [],
      physicalLimitations: currentUserProfile?.physicalLimitations || [],
      activityTypePreferences: currentUserProfile?.activityTypePreferences || [],
      activityTypeDislikes: currentUserProfile?.activityTypeDislikes || [],
      environmentalSensitivities: currentUserProfile?.environmentalSensitivities || [],
      travelTolerance: currentUserProfile?.travelTolerance || '',
      budgetFlexibilityNotes: currentUserProfile?.budgetFlexibilityNotes || '',
      socialPreferences: currentUserProfile?.socialPreferences || { preferredGroupSize: null, interactionLevel: null },
      availabilityNotes: currentUserProfile?.availabilityNotes || '',
    },
  });

  const currentQuestion = questions[currentQuestionIndex];
  const typingSpeed = 50; // ms per character

  // Generate Crossy reactions based on question and selection
  const getCrossyReaction = (questionId: string, selectedCount: number, totalCount: number) => {
    const reactions = {
      allergies: [
        "Oh no! 😰 We'll make sure to avoid those!",
        "Got it! 🚫 We'll keep you safe!",
        "Noted! 📝 Safety first!",
        "Understood! 🛡️ We'll be extra careful!"
      ],
      dietary: [
        "Respect! 🙏 We'll find perfect options!",
        "No worries! 🌱 We've got alternatives!",
        "Got it! 🥗 We'll accommodate that!",
        "Perfect! 🎯 We'll match your needs!"
      ],
      cuisines: [
        "Yum! 😋 Great taste!",
        "Delicious! 🍽️ Love your choices!",
        "Mmm! 🤤 Those sound amazing!",
        "Excellent! ⭐ You know good food!"
      ],
      physicalLimitations: [
        "We'll adapt! ♿ Accessibility matters!",
        "No problem! 💪 We'll work around that!",
        "Got it! 🎯 We'll find suitable options!",
        "Understood! 🤝 We'll accommodate you!"
      ],
      activityPreferences: [
        "Awesome! 🎉 Love your energy!",
        "Perfect! ⚡ You're adventurous!",
        "Great choices! 🌟 You're active!",
        "Exciting! 🚀 Let's get moving!"
      ]
    };

    const questionReactions = reactions[questionId as keyof typeof reactions] || [
      "Nice choice! 👍",
      "Great pick! ⭐",
      "Excellent! 🎯",
      "Perfect! 🎉"
    ];

    // Show different reactions based on selection count
    if (selectedCount === 0) {
      return "Take your time! 😊";
    } else if (selectedCount === 1) {
      return "One down! 🎯";
    } else if (selectedCount === 2) {
      return "Two great choices! ✨";
    } else if (selectedCount === 3) {
      return "Almost there! 🚀";
    } else if (selectedCount === 4) {
      return questionReactions[Math.floor(Math.random() * questionReactions.length)];
    }

    return questionReactions[Math.floor(Math.random() * questionReactions.length)];
  };

  // Typewriter effect for questions
  useEffect(() => {
    if (currentQuestion) {
      setIsTyping(true);
      setShowInput(false);
      setCroissantMood('thinking');
      
      // The typing completion will be handled by the SpeechBubble component
      // which will call onComplete when typing is done
    }
  }, [currentQuestionIndex]);

  const handleResponse = (response: any) => {
    setResponses(prev => ({ ...prev, [currentQuestion.id]: response }));
    setCroissantMood('excited');
    
    // Update form values
    const formUpdates: any = {};
    switch (currentQuestion.id) {
      case 'welcome':
      case 'ready':
      case 'almostDone':
        // Button responses don't need form updates
        break;
      case 'name':
        formUpdates.name = response;
        break;
      case 'birthDate':
        formUpdates.birthDate = response;
        break;
      case 'allergies':
        formUpdates.allergies = response;
        break;
      case 'dietary':
        formUpdates.dietaryRestrictions = response;
        break;
      case 'cuisines':
        formUpdates.favoriteCuisines = response;
        break;
      case 'physicalLimitations':
        formUpdates.physicalLimitations = response;
        break;
      case 'activityPreferences':
        formUpdates.activityTypePreferences = response;
        break;
      case 'travelTolerance':
        formUpdates.travelTolerance = response;
        break;
      case 'interactionLevel':
        formUpdates.socialPreferences = {
          ...formUpdates.socialPreferences,
          interactionLevel: response
        };
        break;
      case 'almostDone':
        // No form updates needed for this step
        break;
      case 'complete':
        // No form updates needed for this step
        break;
    }
    
    // Update form values safely
    if (Object.keys(formUpdates).length > 0) {
      Object.entries(formUpdates).forEach(([key, value]) => {
        if (key === 'socialPreferences') {
          form.setValue('socialPreferences', value as any);
        } else {
          (form.setValue as any)(key, value);
        }
      });
    }
    
    // Show response and move to next question
    setTimeout(() => {
      setCroissantMood('idle');
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        handleComplete();
      }
    }, 1500);
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const authUserDataPayload = {
        uid: user!.uid,
        displayName: user!.displayName,
        email: user!.email,
        photoURL: user!.photoURL,
      };

      const formData = form.getValues();
      const result = await completeOnboardingAction({
        ...formData,
        name: formData.name || null,
        environmentalSensitivities: formData.environmentalSensitivities || []
      }, authUserDataPayload);

      if (result.success) {
        toast({
          title: "Welcome to Crossand! 🥐",
          description: "Your profile is complete and you're ready to start planning!",
        });
        
        await refreshProfileStatus();
          acknowledgeNewUserWelcome();
        router.push('/feed');
      } else {
        toast({ title: "Save Failed", description: result.error || "An unknown error occurred.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Onboarding submission error:", error);
      toast({ title: "Error", description: `Could not save profile: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderInput = () => {
    if (!showInput || !currentQuestion) return null;

    switch (currentQuestion.type) {
      case 'button':
    return (
          <motion.div variants={inputVariants} initial="hidden" animate="visible" exit="exit" className="mt-4 flex justify-center">
            <button
              onClick={() => handleResponse('acknowledged')}
              className="bg-orange-400 text-white hover:bg-orange-500 px-6 py-2 rounded-full text-sm font-medium transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              {currentQuestion.buttonText}
            </button>
          </motion.div>
        );

      case 'text':
    return (
          <motion.div variants={inputVariants} initial="hidden" animate="visible" exit="exit" className="mt-4 space-y-4">
            <Input
              placeholder={currentQuestion.placeholder}
              maxLength={currentQuestion.maxLength}
              className="w-full max-w-md"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  handleResponse(e.currentTarget.value.trim());
                }
              }}
              autoFocus
            />
            <div className="flex justify-center">
              <button
                onClick={() => {
                  const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                  if (input && input.value.trim()) {
                    handleResponse(input.value.trim());
                  }
                }}
                className="bg-orange-400 text-white hover:bg-orange-500 px-6 py-2 rounded-full text-sm font-medium transition-colors duration-200 shadow-lg hover:shadow-xl"
              >
                Continue
              </button>
        </div>
          </motion.div>
        );

      case 'select':
        if (currentQuestion.id === 'travelTolerance') {
  return (
            <TravelToleranceSlider
              sliderValue={sliderValue}
              setSliderValue={setSliderValue}
              handleResponse={handleResponse}
              currentQuestion={currentQuestion}
            />
          );
        }
        
        if (currentQuestion.id === 'interactionLevel') {
          return (
            <InteractionLevelSelector
              handleResponse={handleResponse}
              currentQuestion={currentQuestion}
            />
          );
        }
        
        return (
          <motion.div variants={inputVariants} initial="hidden" animate="visible" exit="exit" className="mt-4 space-y-2">
            {currentQuestion.options?.map((option) => (
                                        <Button
                key={option}
                                        variant="outline"
                className="w-full max-w-md justify-start"
                onClick={() => handleResponse(option)}
              >
                {option}
                                        </Button>
            ))}
          </motion.div>
        );

      case 'multiSelect':
        return (
          <motion.div variants={inputVariants} initial="hidden" animate="visible" exit="exit" className="mt-4">
            <div className="flex flex-wrap gap-2 max-w-md justify-center">
              {currentQuestion.options?.map((option, index) => {
                const current = responses[currentQuestion.id] || [];
                const isSelected = current.includes(option);
                const isDisabled = !isSelected && current.length >= 4;
                
                return (
                  <motion.button
                    key={option}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className={`px-3 py-2 rounded-full border-2 transition-all duration-200 text-xs font-medium ${
                      isSelected
                        ? 'bg-yellow-400 text-black border-yellow-400 shadow-lg scale-105'
                        : isDisabled
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'
                        : 'bg-transparent text-gray-800 border-gray-400 hover:border-gray-300 hover:scale-105'
                    }`}
                    onClick={() => {
                      if (isDisabled) return;
                      const newSelection = isSelected
                        ? current.filter((item: string) => item !== option)
                        : [...current, option];
                      setResponses(prev => ({ ...prev, [currentQuestion.id]: newSelection }));
                      
                      // Show Crossy reaction
                      const reaction = getCrossyReaction(currentQuestion.id, newSelection.length, currentQuestion.options?.length || 0);
                      setCrossyReaction(reaction);
                      setShowCrossyReaction(true);
                      
                      // Hide reaction after 2 seconds
                      setTimeout(() => {
                        setShowCrossyReaction(false);
                      }, 2000);
                    }}
                    whileHover={!isDisabled ? { scale: 1.05 } : {}}
                    whileTap={!isDisabled ? { scale: 0.95 } : {}}
                    disabled={isDisabled}
                  >
                    {option}
                  </motion.button>
                );
              })}
                        </div>
            <div className="mt-3 flex justify-center">
              <div className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
                {currentQuestion.options && (responses[currentQuestion.id] || []).length}/4 selected
                        </div>
                        </div>
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => handleResponse(responses[currentQuestion.id] || [])}
                className="bg-orange-400 text-white hover:bg-orange-500 px-6 py-2 rounded-full text-sm font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                disabled={(responses[currentQuestion.id] || []).length === 0}
              >
                Continue
              </button>
                    </div>
          </motion.div>
        );

      case 'date':
        return (
          <motion.div variants={inputVariants} initial="hidden" animate="visible" exit="exit" className="mt-4 space-y-4">
            <Input
              type="date"
              className="w-full max-w-md"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value) {
                  handleResponse(e.currentTarget.value);
                }
              }}
              autoFocus
            />
            <div className="flex justify-center">
              <button
                onClick={() => {
                  const input = document.querySelector('input[type="date"]') as HTMLInputElement;
                  if (input && input.value) {
                    handleResponse(input.value);
                  }
                }}
                className="bg-orange-400 text-white hover:bg-orange-500 px-6 py-2 rounded-full text-sm font-medium transition-colors duration-200 shadow-lg hover:shadow-xl"
              >
                Continue
              </button>
                    </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
                    </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-amber-50 to-orange-100 flex flex-col">
      <style jsx>{`
        .slider {
          -webkit-appearance: none;
          appearance: none;
          background: linear-gradient(to right, #fbbf24, #f59e0b);
          outline: none;
        }
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
      {/* Header */}
      <div className="p-4">
                    <Button
                      variant="ghost"
                      onClick={signOut}
          className="text-orange-600 hover:text-orange-700"
                    >
          <LogOut className="h-4 w-4 mr-2" />
          Log Out
                    </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {/* Croissant Character */}
        <div className="mb-8">
          <CroissantCharacter 
            mood={croissantMood} 
            size="md" 
            reaction={crossyReaction}
            showReaction={showCrossyReaction}
          />
        </div>

        {/* Speech Bubble */}
        <AnimatePresence mode="wait">
          <SpeechBubble
            key={currentQuestionIndex}
            text={currentQuestion.text}
            isTyping={isTyping}
            typingSpeed={typingSpeed}
            onComplete={useCallback(() => {
              setIsTyping(false);
              setShowInput(true);
              setCroissantMood('idle');
            }, [])}
          >
            {renderInput()}
          </SpeechBubble>
        </AnimatePresence>

        {/* Progress Indicator */}
        <div className="mt-8 flex gap-1">
          {questions.map((_, index) => (
            <div
              key={index}
              className={`rounded-full transition-all duration-300 ${
                index < currentQuestionIndex
                  ? 'bg-green-500 w-2 h-2'
                  : index === currentQuestionIndex
                  ? 'bg-orange-500 w-4 h-3'
                  : 'bg-gray-300 w-2 h-2'
              }`}
            />
          ))}
                </div>

        {/* Loading State */}
        {isSubmitting && (
          <div className="mt-8 flex items-center gap-2 text-orange-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Saving your profile...</span>
              </div>
        )}
            </div>
          </div>
  );
}
