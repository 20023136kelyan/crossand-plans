// src/types/user.ts

import type { Timestamp as ClientTimestamp, GeoPoint } from 'firebase/firestore';
import type { FieldValue } from 'firebase-admin/firestore';

// Simplified Timestamp type for use in interfaces, services will handle specific SDK types
export type AppTimestamp = ClientTimestamp | Date | string;

export type UserRoleType = 'user' | 'admin' | 'influencer' | 'corporate';

export type TransitMode = 'driving' | 'walking' | 'bicycling' | 'transit';
export type PlanStatusType = 'draft' | 'published' | 'cancelled';
export type PlanTypeType = 'single-stop' | 'multi-stop';
export type PriceRangeType = '$' | '$$' | '$$$' | '$$$$' | 'Free';

export interface UserProfile {
  uid: string; 
  name: string | null; // Full name of the user
  username: string | null; // Unique username for the user
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
  preferredTransitModes?: TransitMode[];
  
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
  isAdmin?: boolean; // Admin status flag for API compatibility

  // Social graph
  followers: string[]; // Array of UIDs of users following this user
  following: string[]; // Array of UIDs of users this user is following
  followersCount?: number; // Count of followers for display
  ratingsCount?: number; // Count of ratings for display
  // 'friends' is derived from mutual follows + friendships subcollection
  
  // Saved content
  savedPlans: string[]; // Array of plan IDs that the user has saved

  // Timestamps
  createdAt: AppTimestamp; 
  updatedAt: AppTimestamp; 

  // Combined preferences for AI
  preferences: string[]; // Derived from all specific preference fields

  // Google user data for onboarding (only stored during initial account creation)
  googleUserData?: {
    given_name?: string | null;
    family_name?: string | null;
    locale?: string | null;
    email_verified?: boolean;
  } | null;
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
> & { birthDate?: string | null; name?: string | null; username?: string | null; email?: string | null; avatarUrl?: string | null; };


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
  username: string | null;
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
  username: string | null;
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

// Interface for creating chat messages with server timestamps
export interface ChatMessageCreate {
  senderId: string;
  text?: string; 
  mediaUrl?: string; 
  mediaContentType?: string;
  timestamp: FieldValue; // FieldValue.serverTimestamp() for server-side creation
  hiddenBy?: string[]; // Array of UIDs who have hidden this message for themselves
}
export type RSVPStatusType = 'going' | 'maybe' | 'not-going' | 'pending';


export interface ItineraryItem {
  id: string;
  placeName: string;
  description: string | null;
  address: string | null;
  tagline?: string | null; // AI-generated summary tagline
  googlePlaceId: string | null;
  city: string | null;
  googlePhotoReference: string | null;
  googleMapsImageUrl: string | null;
  lat: number | null;
  lng: number | null;
  types: string[] | null;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  phoneNumber: string | null;
  isOperational: boolean | null;
  statusText: string | null;
  openingHours: string[] | null;
  website: string | null;
  activitySuggestions: string[] | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  transitMode: TransitMode | null;
  transitTimeFromPreviousMinutes?: number | null;
  notes: string | null;
  suggestedActivities?: string[];
  noiseLevel?: 'low' | 'moderate' | 'high' | null;
  reservationRecommended?: boolean;
  bookingLink?: string | null;
}

export type PlanStatus = 'draft' | 'published' | 'archived' | 'completed' | 'cancelled';
export type PlanType = 'single-stop' | 'multi-stop';
export type ParticipantResponse = 'going' | 'maybe' | 'not-going' | 'pending';

// Enhanced RSVP types for advanced features
export interface RSVPDetails {
  response: ParticipantResponse;
  guestCount?: number; // Number of additional guests (plus-ones)
  dietaryRestrictions?: string[];
  specialRequests?: string;
  notes?: string;
  respondedAt: string;
  lastUpdated?: string;
}

export interface PlanRSVPSettings {
  allowGuestPlusOnes: boolean;
  maxGuestsPerParticipant: number;
  rsvpDeadline?: string;
  requireDietaryInfo: boolean;
  requireSpecialRequests: boolean;
  enableWaitlist: boolean;
  maxParticipants?: number;
  sendReminders: boolean;
  reminderDays: number[]; // Days before event to send reminders
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  eventTime: string;
  location: string;
  primaryLocation?: string;
  city: string;
  eventType: string | null;
  eventTypeLowercase: string;
  priceRange: PriceRangeType;
  hostId: string;
  hostName?: string;
  hostAvatarUrl?: string;
  creatorName?: string;
  creatorUsername?: string;
  creatorAvatarUrl?: string;
  creatorIsVerified?: boolean;
  invitedParticipantUserIds: string[];
  participantUserIds: string[];
  itinerary: ItineraryItem[];
  status: PlanStatus;
  planType: PlanType;
  originalPlanId: string | null;
  sharedByUid: string | null;
  averageRating: number | null;
  reviewCount: number;
  photoHighlights: string[];
  images: { url: string; alt: string }[];
  comments: Comment[];
  participantResponses: Record<string, ParticipantResponse>;
  participantRSVPDetails?: Record<string, RSVPDetails>;
  rsvpSettings?: PlanRSVPSettings;
  waitlist?: string[]; // Array of user IDs on waitlist
  createdAt: string;
  updatedAt: string;
  coordinates?: GeoPoint;
  recentSaves?: string[];
  recentViews?: string[];
  recentCompletions?: string[];
  ratings?: Array<{
    userId: string;
    value: number;
    isVerified: boolean;
  }>;
  featured?: boolean;
  isPremiumOnly?: boolean;
  minimumActivityScore?: number;
  venues?: Array<{
    id: string;
    name: string;
    discount: number;
  }>;
  participantsCount?: number;
  likesCount?: number;
  sharesCount?: number;
  savesCount?: number;
  type?: 'dayInLife' | 'regular';
  /** @deprecated Use status field instead. Will be removed in future version. */
  isCompleted?: boolean;
  completedAt?: string; // When the plan was marked as completed
  completionConfirmedBy?: string[]; // Array of user IDs who confirmed completion
  // Individual completion tracking is handled via PlanCompletion collection
  highlightsEnabled?: boolean;
  isTemplate?: boolean; // For admin-created template plans that don't require specific scheduling
  templateOriginalHostId?: string; // Original host ID when plan becomes template
  templateOriginalHostName?: string; // Original host name when plan becomes template
  waitlistUserIds?: string[]; // Array of user IDs on waitlist
  privateNotes?: string | null; // Private notes that get cleared when becoming template
  noisePreference?: 'quiet' | 'moderate' | 'lively' | null;
  stopCountReasoning?: {
    chosenCount: number;
    reasons: string[];
    comparisonAnalysis: Array<{
      alternativeCount: number;
      whyNotChosen: string;
    }>;
    timeConsiderations: string;
    groupFactors: string;
    qualityImpact: string;
  } | null;
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
  username: string | null; 
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
  isDefault?: boolean; // Marks system default collections
  navigationCard?: boolean; // Shows in navigation/browse section
  icon?: string; // Icon name for navigation cards
  href?: string; // Navigation link for cards
  sortOrder?: number; // Display order for navigation cards
  createdAt?: string; // ISO String
  updatedAt?: string; // ISO String
}

export type FeedPostVisibility = 'public' | 'private';

export interface FeedPost {
  id: string;
  userId: string;
  userName: string;
  username: string | null;
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
  username: string | null;
  userAvatarUrl: string | null;
  userRole: UserRoleType | null;
  userIsVerified: boolean;
  text: string;
  createdAt: AppTimestamp;
}


export interface Influencer { // Used for Explore Page display
  id: string; // User UID
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  imageUrl?: string;
  date?: string;
  location?: string;
  type?: string;
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

export interface Profile {
  id: string;
  name: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  imageUrl?: string;
  bio?: string;
  isVerified?: boolean;
  tags?: string[];
  type?: string;
  date?: string;
  location?: string;
}

export interface Category {
  name: string;
  description?: string;
  iconUrl?: string;
}

export interface City {
  id: string;
  name: string;
  date: string;
  location: string;
  imageUrl?: string;
}

export interface PlanCompletion {
  id: string;
  planId: string;
  userId: string;
  completedAt: string;
  verificationMethod: 'qr_code' | 'manual' | 'auto';
  qrCodeData?: string;
  participantIds: string[];
  venueVerified?: boolean;
}

export interface UserAffinity {
  userId1: string;
  userId2: string;
  score: number;
  lastUpdated: string;
  completedPlansCount: number;
  lastPlanCompletedAt: string;
}

// Simplified profile for AI processing
export interface AISimpleProfile {
  uid: string;
  preferences: string[];
}
