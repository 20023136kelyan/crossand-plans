export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  birthDate?: string; // ISO Date string
  age?: number;
  address: { 
    street: string; 
    city: string;   
    state?: string | null; // Allow null
    zipCode?: string | null; // Allow null
    country: string; 
  };
  allergies: string[];
  dietaryRestrictions: string[];
  preferences: string[]; 
  favoriteCuisines: string[]; 
  
  physicalLimitations: string[];
  activityTypePreferences: string[];
  activityTypeDislikes: string[];
  environmentalSensitivities: string[];
  travelTolerance?: string | null; 
  budgetFlexibilityNotes?: string | null; 
  socialPreferences: string[]; 

  availability?: string | null; 
  avatarUrl?: string;

  eventAttendanceScore: number;
  levelTitle: string;
  levelStars: number; 
}

export interface Friend {
  id: string;
  userId: string; 
  name: string; 
  nickname?: string;
  status: 'pending_sent' | 'pending_received' | 'accepted';
  avatarUrl?: string;
  preferences?: string[]; 
}

export type PlanStatus = 'draft' | 'active' | 'confirmed' | 'completed' | 'cancelled';

export interface ItineraryItem {
  id: string; 
  placeName: string;
  address: string;
  city?: string | null;
  description?: string | null;
  startTime?: string | null; 
  endTime?: string | null;   
  googleMapsImageUrl?: string | null;
  rating?: number | null; 
  reviewCount?: number | null; 
  activitySuggestions?: string[] | null;
}

export interface Plan {
  id: string;
  hostId: string;
  name: string;
  description: string;
  eventTime: string;
  location: string; 
  city: string; 
  eventType?: string; 
  priceRange: string; 
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
  itinerary?: ItineraryItem[];
  invitedParticipantUserIds: string[];
  selectedPoint?: { lat: number; lng: number } | null;
  mapRadiusKm?: number | null;
  planType: 'single-stop' | 'multi-stop';
  userEnteredCityForStep2?: string | null;
}

export interface Participant {
  id: string;
  planId: string;
  userId: string;
  name: string; 
  confirmationStatus: 'pending' | 'confirmed' | 'declined';
  avatarUrl?: string;
  preferences?: string[]; 
}

export interface EventSuggestion {
  id: string;
  title: string;
  description: string;
  estimatedCost?: string;
}

// Mock current user ID
export const MOCK_USER_ID = 'user_123';
