// src/services/clientServices.ts
// Essential client-side functions for real-time subscriptions
'use client';

import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc,
  getDocs,
  limit,
  Unsubscribe 
} from 'firebase/firestore';
import type { 
  UserProfile, 
  FriendEntry, 
  Chat, 
  Plan, 
  FeedComment,
  ChatMessage 
} from '@/types/user';

// Helper function to ensure db is initialized
function getDb() {
  if (!db) {
    throw new Error('Firebase not initialized');
  }
  return db;
}

// ===== REAL-TIME SUBSCRIPTION FUNCTIONS =====

/**
 * Subscribe to user's friendships with real-time updates
 */
export function getFriendships(
  userId: string,
  onUpdate: (friendships: FriendEntry[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onError?.(new Error('User ID is required'));
    return () => {};
  }

  try {
    const friendshipsRef = collection(getDb(), 'users', userId, 'friendships');
    
    return onSnapshot(
      friendshipsRef,
      (snapshot) => {
        try {
          const friendships: FriendEntry[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            friendships.push({
              friendUid: data.friendUid || doc.id,
              status: data.status || 'friends',
              name: data.name || data.displayName || 'Unknown',
              avatarUrl: data.avatarUrl || data.avatar || null,
              role: data.role || null,
              isVerified: data.isVerified || false,
              requestedAt: data.requestedAt || null,
              friendsSince: data.friendsSince || null
            });
          });
          onUpdate(friendships);
        } catch (error) {
          onError?.(error instanceof Error ? error : new Error('Failed to process friendships'));
        }
      },
      (error) => {
        onError?.(error instanceof Error ? error : new Error('Friendships subscription failed'));
      }
    );
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('Failed to initialize friendships subscription'));
    return () => {};
  }
}

/**
 * Subscribe to user's chats with real-time updates
 */
export function getUserChats(
  userId: string,
  onUpdate: (chats: Chat[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onError?.(new Error('User ID is required'));
    return () => {};
  }

  try {
    const chatsQuery = query(
      collection(getDb(), 'chats'),
      where('participants', 'array-contains', userId),
      orderBy('lastMessageTimestamp', 'desc')
    );

    return onSnapshot(
      chatsQuery,
      (snapshot) => {
        try {
          const chats: Chat[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            chats.push({
              id: doc.id,
              participants: data.participants || [],
              participantInfo: data.participantInfo || [],
              type: data.type || 'direct',
              lastMessageText: data.lastMessageText || data.lastMessage || '',
              lastMessageSenderId: data.lastMessageSenderId || '',
              lastMessageTimestamp: data.lastMessageTimestamp || null,
              participantReadTimestamps: data.participantReadTimestamps || {},
              groupName: data.groupName,
              groupAvatarUrl: data.groupAvatarUrl || null,
              createdAt: data.createdAt || '',
              updatedAt: data.updatedAt || ''
            });
          });
          onUpdate(chats);
        } catch (error) {
          onError?.(error instanceof Error ? error : new Error('Failed to process chats'));
        }
      },
      (error) => {
        onError?.(error instanceof Error ? error : new Error('Chats subscription failed'));
      }
    );
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('Failed to initialize chats subscription'));
    return () => {};
  }
}

/**
 * Subscribe to pending plan shares for a user
 */
export function getPendingPlanSharesForUser(
  userId: string,
  onUpdate: (shares: any[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onError?.(new Error('User ID is required'));
    return () => {};
  }

  try {
    const sharesQuery = query(
      collection(getDb(), 'planShares'),
      where('inviteeId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(
      sharesQuery,
      (snapshot) => {
        try {
          const shares: any[] = [];
          snapshot.forEach((doc) => {
            shares.push({
              id: doc.id,
              ...doc.data()
            });
          });
          onUpdate(shares);
        } catch (error) {
          onError?.(error instanceof Error ? error : new Error('Failed to process plan shares'));
        }
      },
      (error) => {
        onError?.(error instanceof Error ? error : new Error('Plan shares subscription failed'));
      }
    );
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('Failed to initialize plan shares subscription'));
    return () => {};
  }
}

/**
 * Subscribe to pending plan invitations count
 */
export function getPendingPlanInvitationsCount(
  userId: string,
  onUpdate: (count: number) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onError?.(new Error('User ID is required'));
    return () => {};
  }

  try {
    const invitationsQuery = query(
      collection(getDb(), 'plans'),
      where('invitedUsers', 'array-contains', userId),
      where('status', '==', 'published')
    );

    return onSnapshot(
      invitationsQuery,
      (snapshot) => {
        try {
          let count = 0;
          const now = new Date();
          
          snapshot.forEach((doc) => {
            const data = doc.data();
            const eventTime = data.eventTime?.toDate?.() || new Date(data.eventTime);
            
            // Only count future events
            if (eventTime > now) {
              count++;
            }
          });
          
          onUpdate(count);
        } catch (error) {
          onError?.(error instanceof Error ? error : new Error('Failed to count invitations'));
        }
      },
      (error) => {
        onError?.(error instanceof Error ? error : new Error('Invitations count subscription failed'));
      }
    );
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('Failed to initialize invitations count subscription'));
    return () => {};
  }
}

/**
 * Subscribe to post comments with real-time updates
 */
export function getPostComments(
  postId: string,
  onUpdate: (comments: FeedComment[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!postId) {
    onError?.(new Error('Post ID is required'));
    return () => {};
  }

  try {
    const commentsQuery = query(
      collection(getDb(), 'feedPosts', postId, 'comments'),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(
      commentsQuery,
      (snapshot) => {
        try {
          const comments: FeedComment[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            comments.push({
              id: doc.id,
              postId: postId,
              userId: data.userId || '',
              userName: data.userName || data.username || 'Unknown',
              username: data.username || null,
              userAvatarUrl: data.userAvatarUrl || data.avatar || null,
              text: data.text || '',
              createdAt: data.createdAt || ''
            });
          });
          onUpdate(comments);
        } catch (error) {
          onError?.(error instanceof Error ? error : new Error('Failed to process comments'));
        }
      },
      (error) => {
        onError?.(error instanceof Error ? error : new Error('Comments subscription failed'));
      }
    );
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('Failed to initialize comments subscription'));
    return () => {};
  }
}

/**
 * Subscribe to completed plans where user is a participant
 */
export function getCompletedPlansForParticipant(
  userId: string,
  onUpdate: (plans: any[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onError?.(new Error('User ID is required'));
    return () => {};
  }

  try {
    const plansQuery = query(
      collection(getDb(), 'plans'),
      where('participantIds', 'array-contains', userId),
      where('status', '==', 'completed'),
      orderBy('completionTimestamp', 'desc'),
      limit(50)
    );

    return onSnapshot(
      plansQuery,
      (snapshot) => {
        try {
          const plans: any[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            plans.push({
              id: doc.id,
              name: data.name || 'Untitled Plan',
              completionTimestamp: data.completionTimestamp?.toDate?.()?.toISOString() || '',
              completionConfirmedBy: data.completionConfirmedBy || [],
              hostAvatarUrl: data.hostAvatarUrl || null,
              updatedAt: data.updatedAt?.toDate?.()?.toISOString() || '',
              ...data
            });
          });
          onUpdate(plans);
        } catch (error) {
          onError?.(error instanceof Error ? error : new Error('Failed to process completed plans'));
        }
      },
      (error) => {
        onError?.(error instanceof Error ? error : new Error('Completed plans subscription failed'));
      }
    );
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('Failed to initialize completed plans subscription'));
    return () => {};
  }
}

/**
 * Subscribe to user's plans with real-time updates
 * Gets both hosted plans and plans the user is invited to
 */
export function getUserPlansSubscription(
  userId: string,
  onUpdate: (plans: Plan[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onError?.(new Error('User ID is required'));
    return () => {};
  }

  try {
    const plansMap = new Map<string, Plan>();
    let hostedUnsubscribe: Unsubscribe | null = null;
    let invitedUnsubscribe: Unsubscribe | null = null;

    const updatePlans = () => {
      const plans = Array.from(plansMap.values()).sort((a, b) => {
        const timeA = new Date(a.eventTime).getTime();
        const timeB = new Date(b.eventTime).getTime();
        return timeB - timeA; // Newest first
      });
      onUpdate(plans);
    };

    // Subscribe to hosted plans
    const hostedQuery = query(
      collection(getDb(), 'plans'),
      where('hostId', '==', userId),
      orderBy('eventTime', 'desc'),
      limit(50)
    );

    hostedUnsubscribe = onSnapshot(
      hostedQuery,
      (snapshot) => {
        try {
          // Clear hosted plans and re-add them
          for (const [planId, plan] of plansMap.entries()) {
            if (plan.hostId === userId) {
              plansMap.delete(planId);
            }
          }

          snapshot.forEach((doc) => {
            const data = doc.data();
            const plan: Plan = {
              id: doc.id,
              name: data.name || 'Untitled Plan',
              description: data.description || null,
              eventTime: data.eventTime || '',
              location: data.location || '',
              city: data.city || '',
              eventType: data.eventType || null,
              eventTypeLowercase: data.eventTypeLowercase || (data.eventType || '').toLowerCase(),
              priceRange: data.priceRange || '$',
              hostId: data.hostId || '',
              hostName: data.hostName || null,
              hostAvatarUrl: data.hostAvatarUrl || null,
              invitedParticipantUserIds: data.invitedParticipantUserIds || [],
              participantUserIds: data.participantUserIds || [],
              participantResponses: data.participantResponses || {},
              waitlistUserIds: data.waitlistUserIds || [],
              itinerary: data.itinerary?.map((item: any) => ({
                ...item,
                startTime: item.startTime || null,
                endTime: item.endTime || null,
              })) || [],
              status: data.status || 'draft',
              planType: data.planType || 'single-stop',
              originalPlanId: data.originalPlanId || null,
              sharedByUid: data.sharedByUid || null,
              averageRating: data.averageRating === undefined ? null : data.averageRating,
              reviewCount: data.reviewCount === undefined ? 0 : data.reviewCount,
              photoHighlights: data.photoHighlights || [],
              images: data.images || [],
              comments: data.comments || [],
              createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || '',
              updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || '',
              coordinates: data.coordinates || undefined,
              completedAt: data.completedAt || undefined,
              completionConfirmedBy: data.completionConfirmedBy || [],
              isTemplate: data.isTemplate || false,
            };
            plansMap.set(plan.id, plan);
          });

          updatePlans(); // Update immediately when hosted plans query completes
        } catch (error) {
          onError?.(error instanceof Error ? error : new Error('Failed to process hosted plans'));
        }
      },
      (error) => {
        onError?.(error instanceof Error ? error : new Error('Hosted plans subscription failed'));
      }
    );

    // Subscribe to invited plans
    const invitedQuery = query(
      collection(getDb(), 'plans'),
      where('invitedParticipantUserIds', 'array-contains', userId),
      orderBy('eventTime', 'desc'),
      limit(50)
    );

    invitedUnsubscribe = onSnapshot(
      invitedQuery,
      (snapshot) => {
        try {
          // Clear invited plans and re-add them (but keep hosted ones)
          for (const [planId, plan] of plansMap.entries()) {
            if (plan.hostId !== userId && plan.invitedParticipantUserIds.includes(userId)) {
              plansMap.delete(planId);
            }
          }

          snapshot.forEach((doc) => {
            const data = doc.data();
            // Skip if this is already added as a hosted plan
            if (data.hostId === userId) return;

            const plan: Plan = {
              id: doc.id,
              name: data.name || 'Untitled Plan',
              description: data.description || null,
              eventTime: data.eventTime || '',
              location: data.location || '',
              city: data.city || '',
              eventType: data.eventType || null,
              eventTypeLowercase: data.eventTypeLowercase || (data.eventType || '').toLowerCase(),
              priceRange: data.priceRange || '$',
              hostId: data.hostId || '',
              hostName: data.hostName || null,
              hostAvatarUrl: data.hostAvatarUrl || null,
              invitedParticipantUserIds: data.invitedParticipantUserIds || [],
              participantUserIds: data.participantUserIds || [],
              participantResponses: data.participantResponses || {},
              waitlistUserIds: data.waitlistUserIds || [],
              itinerary: data.itinerary?.map((item: any) => ({
                ...item,
                startTime: item.startTime || null,
                endTime: item.endTime || null,
              })) || [],
              status: data.status || 'draft',
              planType: data.planType || 'single-stop',
              originalPlanId: data.originalPlanId || null,
              sharedByUid: data.sharedByUid || null,
              averageRating: data.averageRating === undefined ? null : data.averageRating,
              reviewCount: data.reviewCount === undefined ? 0 : data.reviewCount,
              photoHighlights: data.photoHighlights || [],
              // Required fields from interface
              images: data.images || [], 
              comments: data.comments || [],
              createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || '',
              updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || '',
              coordinates: data.coordinates || undefined,
              completedAt: data.completedAt || undefined,
              completionConfirmedBy: data.completionConfirmedBy || [],
              isTemplate: data.isTemplate || false,
            };
            plansMap.set(plan.id, plan);
          });

          updatePlans(); // Update immediately when invited plans query completes
        } catch (error) {
          onError?.(error instanceof Error ? error : new Error('Failed to process invited plans'));
        }
      },
      (error) => {
        onError?.(error instanceof Error ? error : new Error('Invited plans subscription failed'));
      }
    );

    // Return combined unsubscribe function
    return () => {
      hostedUnsubscribe?.();
      invitedUnsubscribe?.();
    };

  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('Failed to initialize user plans subscription'));
    return () => {};
  }
}

/**
 * Get user's saved plan IDs
 */
export async function getUserSavedPlans(userId: string): Promise<string[]> {
  if (!userId) return [];

  try {
    const userDoc = await getDoc(doc(getDb(), 'users', userId));
    if (!userDoc.exists()) return [];

    const data = userDoc.data();
    return data.savedPlans || [];
  } catch (error) {
    console.error('Error fetching user saved plans:', error);
    return [];
  }
}

// ===== DATA FETCHING FUNCTIONS =====

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!userId) return null;

  try {
    const userDoc = await getDoc(doc(getDb(), 'users', userId));
    if (!userDoc.exists()) return null;

    const data = userDoc.data();
    return {
      ...data,
      uid: userDoc.id,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || '',
    } as unknown as UserProfile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

/**
 * Get multiple user profiles by IDs
 */
export async function getUsersProfiles(userIds: string[]): Promise<UserProfile[]> {
  if (!userIds.length) return [];

  try {
    const profiles: UserProfile[] = [];
    
    // Fetch in chunks to avoid Firestore limits
    const chunkSize = 10;
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      const promises = chunk.map(id => getUserProfile(id));
      const chunkProfiles = await Promise.all(promises);
      profiles.push(...chunkProfiles.filter(Boolean) as UserProfile[]);
    }
    
    return profiles;
  } catch (error) {
    console.error('Error fetching multiple user profiles:', error);
    return [];
  }
}

/**
 * Get plan by ID
 */
export async function getPlanById(planId: string): Promise<Plan | null> {
  if (!planId) return null;

  try {
    const planDoc = await getDoc(doc(getDb(), 'plans', planId));
    if (!planDoc.exists()) return null;

    const data = planDoc.data();
    return {
      ...data,
      id: planDoc.id,
    } as unknown as Plan;
  } catch (error) {
    console.error('Error fetching plan:', error);
    return null;
  }
}

/**
 * Get user's plans
 */
export async function getUserPlans(userId: string): Promise<Plan[]> {
  if (!userId) return [];

  try {
    // Get plans where user is the host
    const hostedPlansQuery = query(
      collection(getDb(), 'plans'),
      where('hostId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    // Get plans where user is an invited participant
    const participantPlansQuery = query(
      collection(getDb(), 'plans'),
      where('invitedParticipantUserIds', 'array-contains', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    // Execute both queries
    const [hostedSnapshot, participantSnapshot] = await Promise.all([
      getDocs(hostedPlansQuery),
      getDocs(participantPlansQuery)
    ]);
    
    const plans: Plan[] = [];
    const planIds = new Set<string>(); // To prevent duplicates
    
    // Process hosted plans
    hostedSnapshot.forEach((doc) => {
      const data = doc.data();
      plans.push({
        id: doc.id,
        ...data,
        // Ensure required properties exist
        images: data.images || [],
        comments: data.comments || []
      } as Plan);
      planIds.add(doc.id);
    });
    
    // Process participant plans (avoid duplicates)
    participantSnapshot.forEach((doc) => {
      if (!planIds.has(doc.id)) {
        const data = doc.data();
        plans.push({
          id: doc.id,
          ...data,
          // Ensure required properties exist
          images: data.images || [],
          comments: data.comments || []
        } as Plan);
      }
    });

    // Sort all plans by creation date (newest first)
    return plans.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
    
  } catch (error) {
    console.error('Error fetching user plans:', error);
    return [];
  }
}

/**
 * Get templates by original plan ID
 * Fetches templates that were created from a specific plan
 */
export async function getTemplatesByOriginalPlanId(originalPlanId: string): Promise<Plan[]> {
  if (!originalPlanId) return [];

  try {
    console.log('🔍 Querying templates for originalPlanId:', originalPlanId);
    
    const templatesQuery = query(
      collection(getDb(), 'plans'),
      where('isTemplate', '==', true),
      where('parentTemplateId', '==', originalPlanId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(templatesQuery);
    console.log('📊 Query result - found', snapshot.size, 'templates');
    
    const templates: Plan[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log('📄 Template data:', { id: doc.id, name: data.name, isTemplate: data.isTemplate, parentTemplateId: data.parentTemplateId });
      templates.push({
        id: doc.id,
        name: data.name || 'Untitled Template',
        description: data.description || null,
        eventTime: data.eventTime || '',
        location: data.location || '',
        city: data.city || '',
        eventType: data.eventType || null,
        eventTypeLowercase: data.eventTypeLowercase || (data.eventType || '').toLowerCase(),
        priceRange: data.priceRange || '$',
        hostId: data.hostId || '',
        hostName: data.hostName || null,
        hostAvatarUrl: data.hostAvatarUrl || null,
        creatorName: data.creatorName || data.hostName || null,
        creatorAvatarUrl: data.creatorAvatarUrl || data.hostAvatarUrl || null,
        creatorIsVerified: data.creatorIsVerified || false,
        invitedParticipantUserIds: data.invitedParticipantUserIds || [],
        participantUserIds: data.participantUserIds || [],
        participantResponses: data.participantResponses || {},
        waitlistUserIds: data.waitlistUserIds || [],
        itinerary: data.itinerary?.map((item: any) => ({
          ...item,
          startTime: item.startTime || null,
          endTime: item.endTime || null,
        })) || [],
        status: data.status || 'published',
        planType: data.planType || 'single-stop',
        originalPlanId: data.originalPlanId || null,
        sharedByUid: data.sharedByUid || null,
        averageRating: data.averageRating === undefined ? null : data.averageRating,
        reviewCount: data.reviewCount === undefined ? 0 : data.reviewCount,
        photoHighlights: data.photoHighlights || [],
        images: data.images || [],
        comments: data.comments || [],
        isTemplate: data.isTemplate || false,
        templateOriginalHostId: data.templateOriginalHostId || null,
        templateOriginalHostName: data.templateOriginalHostName || null,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      } as Plan);
    });

    console.log('✅ Returning', templates.length, 'templates');
    return templates;
  } catch (error) {
    console.error('Error fetching templates by original plan ID:', error);
    return [];
  }
}