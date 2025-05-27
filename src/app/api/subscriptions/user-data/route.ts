import { NextResponse } from "next/server";
import { getActiveSubscription } from "@/services/subscriptionService.admin";
import { getUserStatsAdmin, getUserProfileAdmin } from "@/services/userService.admin";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [subscription, userStats, userProfile] = await Promise.all([
      getActiveSubscription(session.user.id),
      getUserStatsAdmin(session.user.id),
      getUserProfileAdmin(session.user.id),
    ]);

    // Calculate activity score
    const activityScore = calculateActivityScore(userStats, userProfile);

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