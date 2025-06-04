import { NextResponse } from "next/server";
import { getActiveSubscription } from "@/services/subscriptionService.admin";
import { getUserStatsAdmin, getUserProfileAdmin } from "@/services/userService.admin";
import { cookies } from "next/headers";
import { authAdmin, firestoreAdmin } from "@/lib/firebaseAdmin";

// Define the UserStats interface to match the expected type
interface UserStats {
  plansCreatedCount: number;
  plansSharedOrExperiencedCount: number;
  postCount: number;
  followersCount: number;
  followingCount: number;
  // Add these fields to match the calculateActivityScore function requirements
  totalRatingsReceived?: number;
  averageRating?: number;
  lastActivityDate?: Date;
}

export async function GET() {
  try {
    // Get the session cookie from the request
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "No session cookie found" }, { status: 401 });
    }

    // Verify the session cookie with Firebase Admin
    if (!authAdmin) {
      console.error('[/api/subscriptions/user-data] Firebase Admin SDK not initialized');
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    let decodedClaims;
    try {
      // Use the correct type for authAdmin - cast to any to avoid type errors
      decodedClaims = await (authAdmin as any).verifySessionCookie(sessionCookie, true);
    } catch (error) {
      console.error('[/api/subscriptions/user-data] Invalid session cookie:', error);
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const userId = decodedClaims.uid;
    
    // Try to get real data, fall back to mock data if needed
    let subscription = null;
    let userStats: UserStats;
    let userProfile;
    
    try {
      // Try to get subscription data from Firestore directly if service fails
      try {
        subscription = await getActiveSubscription(userId);
      } catch (serviceError) {
        console.warn(`[/api/subscriptions/user-data] Service error getting subscription for user ${userId}:`, serviceError);
        
        // Fallback to direct Firestore query if service fails
        if (firestoreAdmin) {
          const db = firestoreAdmin as any;
          const subscriptionsQuery = await db.collection('subscriptions')
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .limit(1)
            .get();
          
          if (!subscriptionsQuery.empty) {
            subscription = subscriptionsQuery.docs[0].data();
          }
        }
      }
    } catch (error) {
      console.warn(`[/api/subscriptions/user-data] Error getting subscription for user ${userId}:`, error);
      // Continue with null subscription
    }
    
    try {
      // Get user stats
      try {
        userStats = await getUserStatsAdmin(userId);
      } catch (serviceError) {
        console.warn(`[/api/subscriptions/user-data] Service error getting user stats:`, serviceError);
        
        // Fallback to direct Firestore query
        if (firestoreAdmin) {
          const db = firestoreAdmin as any;
          const userStatsDoc = await db.collection('userStats').doc(userId).get();
          
          if (userStatsDoc.exists) {
            userStats = userStatsDoc.data() as UserStats;
          } else {
            throw new Error('User stats not found');
          }
        } else {
          throw new Error('Firestore admin not available');
        }
      }
    } catch (error) {
      console.warn(`[/api/subscriptions/user-data] Error getting user stats for user ${userId}:`, error);
      // Use mock stats as fallback with required fields
      userStats = {
        plansCreatedCount: 0,
        plansSharedOrExperiencedCount: 0,
        postCount: 0,
        followersCount: 0,
        followingCount: 0
      };
    }
    
    try {
      // Get user profile
      try {
        userProfile = await getUserProfileAdmin(userId);
      } catch (serviceError) {
        console.warn(`[/api/subscriptions/user-data] Service error getting user profile:`, serviceError);
        
        // Fallback to direct Firestore query
        if (firestoreAdmin) {
          const db = firestoreAdmin as any;
          const userProfileDoc = await db.collection('userProfiles').doc(userId).get();
          
          if (userProfileDoc.exists) {
            userProfile = userProfileDoc.data();
          } else {
            throw new Error('User profile not found');
          }
        } else {
          throw new Error('Firestore admin not available');
        }
      }
    } catch (error) {
      console.warn(`[/api/subscriptions/user-data] Error getting user profile for user ${userId}:`, error);
      // Use basic profile as fallback
      userProfile = {
        name: decodedClaims.name || "User",
        email: decodedClaims.email || "",
        avatarUrl: decodedClaims.picture || null,
        eventAttendanceScore: 0
      };
    }
    
    // Ensure userStats is not null and has all required fields for calculateActivityScore
    const safeUserStats = userStats || {
      plansCreatedCount: 0,
      plansSharedOrExperiencedCount: 0,
      postCount: 0,
      followersCount: 0,
      followingCount: 0,
      totalRatingsReceived: 0,
      averageRating: 0,
      lastActivityDate: new Date()
    };
    
    // Cast to any to avoid type issues with the calculateActivityScore function
    const activityScore = calculateActivityScore(safeUserStats as any, userProfile);

    return NextResponse.json({
      subscription,
      userStats,
      userProfile,
      activityScore,
    });
  } catch (error) {
    console.error("[/api/subscriptions/user-data] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function calculateActivityScore(userStats: Awaited<ReturnType<typeof getUserStatsAdmin>>, userProfile: Awaited<ReturnType<typeof getUserProfileAdmin>>): number {
  if (!userStats || !userProfile) return 0;

  // Calculate score based on various factors
  const plansScore = Math.min(userStats.plansCreatedCount / 10, 1) * 30; // Max 30 points for plans
  const sharingScore = Math.min(userStats.plansSharedOrExperiencedCount / 20, 1) * 30; // Max 30 points for sharing
  const attendanceScore = (userProfile.eventAttendanceScore / 100) * 40; // Max 40 points for attendance

  return Math.round(plansScore + sharingScore + attendanceScore);
} 