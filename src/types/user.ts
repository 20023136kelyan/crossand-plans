// src/types/user.ts

import type { Timestamp as ClientTimestamp } from 'firebase/firestore'; 

// Simplified Timestamp type for use in interfaces, services will handle specific SDK types
export type AppTimestamp = ClientTimestamp | Date | string; 

export type UserRoleType = 'user' | 'admin' | 'influencer' | 'corporate';

export interface UserProfile {
  uid: string; 
  name: string | null;
  name_lowercase?: string | null; 
  email: string | null; // Should be unique
  bio?: string | null; 
  countryDialCode: string | null;
  phoneNumber: string | null; // Store local part, countryDialCode stored separately
  birthDate: AppTimestamp | null; 
  physicalAddress: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    country?: string | null;
  } | null;
  avatarUrl: string | null;

  // Detailed Preferences
  allergies: string[];
  dietaryRestrictions: string[];
  generalPreferences: string; // General likes/dislikes text
  favoriteCuisines: string[];
  physicalLimitations: string[];
  activityTypePreferences: string[];
  activityTypeDislikes: string[];
  environmentalSensitivities: string[];
  
  // Planning Style
  travelTolerance: string; // e.g., "Up to 1 hour", "Any distance for the right event"
  budgetFlexibilityNotes: string; // e.g., "Prefers free/cheap, splurges occasionally"
  socialPreferences: {
    preferredGroupSize: string | null; // e.g., "Solo", "Small (2-4)", "Medium (5-8)", "Large (8+)"
    interactionLevel: string | null; // e.g., "Mostly observing", "Balanced", "Very talkative"
  } | null;

  // Availability
  availabilityNotes: string; // General notes about availability

  // Gamification Elements
  eventAttendanceScore: number;
  levelTitle: string;
  levelStars: number; // e.g., 1-5

  // App-specific status/role
  role: UserRoleType | null;
  isVerified: boolean;

  // Social graph
  followers: string[]; // Array of UIDs of users following this user
  following: string[]; // Array of UIDs of users this user is following
  // 'friends' is derived from mutual follows + friendships subcollection

  // Timestamps
  createdAt: AppTimestamp; 
  updatedAt: AppTimestamp; 

  // Combined preferences for AI
  preferences: string[]; // Derived from all specific preference fields
}

// Data collected during onboarding, subset of UserProfile
export type OnboardingProfileData = Pick<
  UserProfile,
  | 'countryDialCode'
  | 'phoneNumber'
  | 'bio'
  // birthDate will be string from form, converted by action
  | 'physicalAddress'
  | 'allergies'
  | 'dietaryRestrictions'
  | 'generalPreferences'
  | 'favoriteCuisines'
  | 'physicalLimitations'
  | 'activityTypePreferences'
  | 'activityTypeDislikes'
  | 'environmentalSensitivities'
  | 'travelTolerance'
  | 'budgetFlexibilityNotes'
  | 'socialPreferences'
  | 'availabilityNotes'
> & { birthDate?: string | null; name?: string | null; email?: string | null; avatarUrl?: string | null; };


export type FriendStatus = 'pending_sent' | 'pending_received' | 'friends';

export interface FriendEntry {
  friendUid: string; 
  status: FriendStatus;
  name: string | null;
  avatarUrl: string | null;
  role?: UserRoleType | null;
  isVerified?: boolean;
  requestedAt?: AppTimestamp | null;
  friendsSince?: AppTimestamp | null; 
}

export interface SearchedUser {
  uid: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  role?: UserRoleType | null;
  isVerified?: boolean;
  friendshipStatus?: FriendStatus | 'not_friends' | 'is_self'; // For UI display relative to viewer
}

export interface UserStats {
  postCount: number;
  plansCreatedCount: number;
  plansSharedOrExperiencedCount: number;
  followersCount: number; 
  followingCount: number; 
}

export interface ChatParticipantInfo {
  uid: string;
  name: string; 
  avatarUrl: string | null;
  role: UserRoleType | null;
  isVerified: boolean;
}

export type ChatType = 'direct' | 'group';

export interface Chat {
  id: string;
  participants: string[]; // Array of UIDs
  participantInfo: ChatParticipantInfo[]; // Denormalized info
  type: ChatType;
  lastMessageText?: string;
  lastMessageSenderId?: string;
  lastMessageTimestamp?: AppTimestamp | null; 
  participantReadTimestamps?: { [userId: string]: AppTimestamp }; // UID: Timestamp
  groupName?: string; // For group chats
  groupAvatarUrl?: string | null; // For group chats
  createdAt: AppTimestamp;
  updatedAt: AppTimestamp;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text?: string; 
  mediaUrl?: string; 
  mediaContentType?: string;
  timestamp: AppTimestamp;
  hiddenBy?: string[]; // Array of UIDs who have hidden this message for themselves
}

export type TransitMode = 'driving' | 'walking' | 'bicycling' | 'transit';
export type PlanStatusType = 'draft' | 'published' | 'cancelled';
export type PlanTypeType = 'single-stop' | 'multi-stop';
export type PriceRangeType = '$' | '$$' | '$$$' | '$$$$' | 'Free';
export type RSVPStatusType = 'going' | 'maybe' | 'declined' | 'pending';


export interface ItineraryItem {
  id: string;
  placeName: string;
  address?: string | null;
  city?: string | null;
  startTime: string; // ISO String
  endTime?: string | null; // ISO String
  description?: string | null;
  googlePlaceId?: string | null;
  lat?: number | null;
  lng?: number | null;
  googlePhotoReference?: string | null; 
  googleMapsImageUrl?: string | null; 
  rating?: number | null;
  reviewCount?: number | null;
  activitySuggestions?: string[] | null;
  isOperational?: boolean | null;
  statusText?: string | null;
  openingHours?: string[] | null;
  phoneNumber?: string | null;
  website?: string | null;
  priceLevel?: number | null;
  types?: string[] | null;
  notes?: string | null;
  durationMinutes?: number | null;
  transitMode?: TransitMode | null;
  transitTimeFromPreviousMinutes?: number | null;
}

export interface Plan {
  id: string;
  name: string;
  description?: string | null;
  eventTime: string; // ISO String
  location: string; 
  city: string; 
  eventType?: string | null;
  // tags?: string[]; // Future use
  priceRange?: PriceRangeType | null;
  hostId: string;
  hostName?: string | null; // Denormalized
  hostAvatarUrl?: string | null; // Denormalized
  invitedParticipantUserIds?: string[] | null;
  participantResponses?: { [userId: string]: RSVPStatusType };
  itinerary: ItineraryItem[];
  status: PlanStatusType;
  planType: PlanTypeType;
  
  originalPlanId?: string | null; // If this plan was copied from another
  sharedByUid?: string | null;    // UID of the user who shared the original plan
  
  averageRating?: number | null;  
  reviewCount?: number; 
  
  photoHighlights?: string[] | null; // Array of image URLs

  createdAt: string; // ISO String
  updatedAt: string; // ISO String
}

export interface Rating {
  userId: string; // User who gave the rating
  planId: string; // Plan being rated
  value: number; // 1-5
  createdAt: AppTimestamp; 
}

export interface Comment {
  id: string; 
  userId: string; 
  planId: string; 
  userName: string | null; 
  userAvatarUrl: string | null; 
  role?: UserRoleType | null; 
  isVerified?: boolean;       
  text: string;
  createdAt: AppTimestamp;
  updatedAt?: AppTimestamp; 
}

export type PlanCollectionType = 'curated_by_team' | 'influencer_picks' | 'user_playlist' | 'algorithmic';

export interface PlanCollection {
  id: string;
  title: string;
  description?: string;
  curatorName?: string; 
  curatorAvatarUrl?: string | null;
  planIds: string[]; 
  coverImageUrl?: string | null; 
  dataAiHint?: string; 
  type: PlanCollectionType;
  tags?: string[];
  isFeatured?: boolean;
  createdAt?: string; // ISO String
  updatedAt?: string; // ISO String
}

export type FeedPostVisibility = 'public' | 'private';

export interface FeedPost {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  userRole: UserRoleType | null;
  userIsVerified: boolean;
  planId: string;
  planName: string;
  mediaUrl: string; // URL of the highlight image
  text: string; // Caption
  visibility: FeedPostVisibility;
  likesCount: number;
  likedBy?: string[]; // Array of UIDs who liked
  commentsCount: number;
  sharesCount?: number; 
  // isFeatured?: boolean; // For promoting specific posts, admin controlled
  createdAt: AppTimestamp; 
}

export interface FeedComment { 
  id: string;
  postId: string;
  userId: string;
  userName: string | null;
  userAvatarUrl: string | null;
  text: string;
  createdAt: AppTimestamp;
}


export interface Influencer { // Used for Explore Page display
  id: string; // User UID
  name: string;
  avatarUrl?: string | null;
  bio?: string | null;
  dataAiHint?: string;
  role: UserRoleType | null; // Added
  isVerified: boolean;      // Added
}

export type PlanShareStatus = 'pending' | 'accepted' | 'declined';

export interface PlanShare {
  id: string;
  originalPlanId: string;
  originalPlanName: string; 
  sharedByUid: string;
  sharedByName: string; 
  sharedByAvatarUrl: string | null; 
  sharedWithUid: string;
  status: PlanShareStatus;
  createdAt: AppTimestamp;
  updatedAt: AppTimestamp;
}

// To ensure ClientTimestamp from firebase/firestore is usable where AppTimestamp is expected
export type FirebaseClientTimestamp = ClientTimestamp;
