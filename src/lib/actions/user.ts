
"use server";

import type { UserProfile } from "@/types";
import { plansDb, participantsDb, userProfilesDb } from "@/lib/mock-data"; 
import { type ProfileSchemaOutput, profileSchema } from "@/lib/schemas"; 
import { revalidatePath } from "next/cache";
import { MOCK_USER_ID } from "@/types";

function calculateAge(birthDateString: string | undefined | null): number | undefined {
  if (!birthDateString) return undefined;
  try {
    const birthDate = new Date(birthDateString);
    if (isNaN(birthDate.getTime())) return undefined;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age < 0 ? 0 : age;
  } catch (e) {
    console.warn("Error calculating age for date:", birthDateString, e);
    return undefined;
  }
}

interface UserLevelInfo {
  title: string;
  stars: number;
}

function calculateUserLevel(score: number): UserLevelInfo {
  if (score <= 5) {
    return { title: "Couch Commander", stars: 1 };
  } else if (score <= 20) {
    return { title: "Casual Cruiser", stars: 2 };
  } else if (score <= 50) {
    return { title: "Activity Ace", stars: 3 };
  } else if (score <= 100) {
    return { title: "Outing Overlord", stars: 4 };
  } else {
    return { title: "Social Sovereign", stars: 5 };
  }
}


export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  console.log(`[getUserProfile] Action started for userId: ${userId}`);
  try {
    const profile = userProfilesDb[userId] || null;
    if (profile) {
      if (profile.birthDate && profile.age === undefined) {
        profile.age = calculateAge(profile.birthDate);
      }
      profile.phoneNumber = profile.phoneNumber || undefined;
      if (!profile.address) {
          profile.address = { street: "", city: "", country: "", state: "", zipCode: "" };
      }
      profile.favoriteCuisines = profile.favoriteCuisines || [];
      profile.physicalLimitations = profile.physicalLimitations || [];
      profile.activityTypePreferences = profile.activityTypePreferences || [];
      profile.activityTypeDislikes = profile.activityTypeDislikes || [];
      profile.environmentalSensitivities = profile.environmentalSensitivities || [];
      profile.travelTolerance = profile.travelTolerance || undefined;
      profile.budgetFlexibilityNotes = profile.budgetFlexibilityNotes || undefined;
      profile.socialPreferences = profile.socialPreferences || [];
      profile.avatarUrl = profile.avatarUrl || undefined;

      const score = profile.eventAttendanceScore || 0; 
      const levelInfo = calculateUserLevel(score);
      profile.levelTitle = levelInfo.title;
      profile.levelStars = levelInfo.stars;
    }
    console.log(`[getUserProfile] Profile for userId ${userId}:`, JSON.stringify(profile, null, 2));
    return profile;
  } catch (error) {
    console.error(`[getUserProfile] UNHANDLED CRITICAL ERROR for userId ${userId}:`, error);
    return null;
  }
}

export async function updateUserProfile(
  databaseKey: string, // This is the key in userProfilesDb, e.g., MOCK_USER_ID
  data: ProfileSchemaOutput
): Promise<{ success: boolean; message?: string; data?: UserProfile }> {
  console.log(`[updateUserProfile] Action started for databaseKey ${databaseKey} with data:`, JSON.stringify(data, null, 2));
  try {
    const validatedData = data; 
    const profileBeingUpdated = userProfilesDb[databaseKey];

    if (!profileBeingUpdated) {
      console.error(`[updateUserProfile] User profile to update not found for databaseKey: ${databaseKey}`);
      return { success: false, message: "User profile to update not found." };
    }

    const oldDisplayId = profileBeingUpdated.id;
    const newDisplayId = validatedData.id;

    if (newDisplayId !== oldDisplayId) {
      for (const keyInDb in userProfilesDb) {
        if (keyInDb !== databaseKey && userProfilesDb[keyInDb].id === newDisplayId) {
          console.warn(`[updateUserProfile] Display ID "${newDisplayId}" is already in use by another profile.`);
          return { success: false, message: `Display ID "${newDisplayId}" is already in use by another profile. Please choose a different ID.` };
        }
      }
    }
    
    const age = calculateAge(validatedData.birthDate);
    const score = profileBeingUpdated.eventAttendanceScore; // Score should not be reset by profile update
    const levelInfo = calculateUserLevel(score);

    const updatedProfileData: UserProfile = {
      ...profileBeingUpdated, // Start with existing data to preserve fields like score
      ...validatedData,       // Override with validated form data
      id: newDisplayId,       // Ensure new display ID is used
      age: age,
      phoneNumber: validatedData.phoneNumber || undefined,
      birthDate: validatedData.birthDate || undefined,
      address: validatedData.address, 
      avatarUrl: validatedData.avatarUrl || profileBeingUpdated.avatarUrl, // Keep old if new is not provided
      preferences: validatedData.preferences, 
      favoriteCuisines: Array.isArray(validatedData.favoriteCuisines) ? validatedData.favoriteCuisines : [],
      physicalLimitations: Array.isArray(validatedData.physicalLimitations) ? validatedData.physicalLimitations : [],
      activityTypePreferences: Array.isArray(validatedData.activityTypePreferences) ? validatedData.activityTypePreferences : [],
      activityTypeDislikes: Array.isArray(validatedData.activityTypeDislikes) ? validatedData.activityTypeDislikes : [],
      environmentalSensitivities: Array.isArray(validatedData.environmentalSensitivities) ? validatedData.environmentalSensitivities : [],
      travelTolerance: validatedData.travelTolerance || undefined,
      budgetFlexibilityNotes: validatedData.budgetFlexibilityNotes || undefined,
      socialPreferences: Array.isArray(validatedData.socialPreferences) ? validatedData.socialPreferences : [],
      eventAttendanceScore: score, // Persist existing score
      levelTitle: levelInfo.title,
      levelStars: levelInfo.stars,
    };
    
    userProfilesDb[databaseKey] = updatedProfileData; 
    console.log(`[updateUserProfile] Profile for databaseKey ${databaseKey} updated in DB.`);

    // Update related data if display ID changed
    if (newDisplayId !== oldDisplayId) {
      console.log(`[updateUserProfile] Display ID changed from ${oldDisplayId} to ${newDisplayId}. Updating related records.`);
      Object.values(plansDb).forEach(plan => {
        if (plan.hostId === oldDisplayId) {
          plansDb[plan.id].hostId = newDisplayId;
        }
      });

      Object.values(participantsDb).forEach(planParticipants => {
        planParticipants.forEach(participant => {
          if (participant.userId === oldDisplayId) {
            participant.userId = newDisplayId;
            participant.name = `${updatedProfileData.firstName} ${updatedProfileData.lastName}`;
            participant.avatarUrl = updatedProfileData.avatarUrl;
          }
        });
      });
    } else { // If ID didn't change, still update name/avatar in participant records
       console.log(`[updateUserProfile] Display ID ${oldDisplayId} unchanged. Updating name/avatar in participant records.`);
       Object.values(participantsDb).forEach(planParticipants => {
        planParticipants.forEach(participant => {
          if (participant.userId === profileBeingUpdated.id) { 
             participant.name = `${updatedProfileData.firstName} ${updatedProfileData.lastName}`;
             participant.avatarUrl = updatedProfileData.avatarUrl;
          }
        });
      });
    }

    console.log("[updateUserProfile] Revalidating paths.");
    revalidatePath("/profile");
    revalidatePath("/plans"); 
    Object.keys(plansDb).forEach(planId => revalidatePath(`/plans/${planId}`));

    return { success: true, data: userProfilesDb[databaseKey], message: "Profile updated successfully!" };
  } catch (error) {
    console.error(`[updateUserProfile] UNHANDLED CRITICAL ERROR for databaseKey ${databaseKey}:`, error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred during profile update.";
    return { success: false, message: `Server error: ${message}. Check server logs.` };
  }
}
