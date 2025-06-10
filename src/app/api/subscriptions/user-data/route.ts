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
    
    // Get user data using service functions
    let subscription = null;
    let userStats: UserStats;
    let userProfile;
    
    try {
      // Get subscription data
      subscription = await getActiveSubscription(userId);
    } catch (error) {
      console.warn(`[/api/subscriptions/user-data] Error getting subscription for user ${userId}:`, error);
      // Continue with null subscription - user may not have an active subscription
    }
    
    try {
      // Get user stats
      userStats = await getUserStatsAdmin(userId);
    } catch (error) {
      console.warn(`[/api/subscriptions/user-data] Error getting user stats for user ${userId}:`, error);
      // Initialize with default stats for new users
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
      userProfile = await getUserProfileAdmin(userId);
    } catch (error) {
      console.warn(`[/api/subscriptions/user-data] Error getting user profile for user ${userId}:`, error);
      // Create basic profile from auth claims for new users (without Google avatar URL)
      // Extract additional Google user information for better onboarding experience
      const firstName = decodedClaims.given_name || "";
      const lastName = decodedClaims.family_name || "";
      const fullName = decodedClaims.name || (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || "User");
      
      userProfile = {
        name: fullName,
        email: decodedClaims.email || "",
        avatarUrl: null, // Don't use Google's picture URL to avoid external requests
        eventAttendanceScore: 0,
        // Store additional Google user data for onboarding pre-fill
        googleUserData: {
          given_name: firstName,
          family_name: lastName,
          locale: decodedClaims.locale || null,
          email_verified: decodedClaims.email_verified || false
        }
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