// src/app/actions/feedActions.ts
'use server';

import { firestoreAdmin, authAdmin } from '@/lib/firebaseAdmin';
import { getUserProfileAdmin } from '@/services/userService.server';
import { 
    getFeedPostsAdmin as getFeedPostsAdminService,
    toggleLikePostAdmin,
    addCommentToPostAdmin as addCommentToPostAdminService,
    incrementPostSharesAdmin as incrementPostSharesAdminService,
    deleteFeedPostAdmin as deleteFeedPostAdminService,
} from '@/services/feedService.server'; 
import type { FeedPost, FeedPostVisibility, UserRoleType, FeedComment } from '@/types/user';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

interface CreateFeedPostData {
  planId: string;
  planName: string;
  highlightImageUrl: string;
  postText: string;
  visibility: FeedPostVisibility;
}

const CreateFeedPostServerSchema = z.object({
    planId: z.string().min(1, "Plan ID is required."),
    planName: z.string().min(1, "Plan name is required."),
    highlightImageUrl: z.string().url("A valid image URL is required."),
    postText: z.string().trim().min(1, "Post text cannot be empty.").max(2000, "Caption too long."),
    visibility: z.enum(['public', 'private'], { errorMap: () => ({ message: "Visibility must be 'public' or 'private'."}) }),
});


export async function createFeedPostAction(
  data: CreateFeedPostData,
  idToken: string
): Promise<{ success: boolean; error?: string; postId?: string }> {
  if (!authAdmin) return { success: false, error: "Server error: Auth service not available." };
  if (!firestoreAdmin) return { success: false, error: "Server error: Database service not available." };

  let decodedToken;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
  } catch (error: any) {
    console.error("[createFeedPostAction] ID Token verification error:", error);
    let e = 'Authentication failed. Invalid or expired token.';
    if (error.code === 'auth/id-token-expired') e = 'Your session has expired. Please log in again.';
    else if (error.code === 'auth/argument-error') e = 'Authentication token is malformed.';
    return { success: false, error: e };
  }
  const userId = decodedToken.uid;

  const validation = CreateFeedPostServerSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: "Invalid data: " + JSON.stringify(validation.error.flatten().fieldErrors) };
  }
  const validatedData = validation.data;

  try {
    const userProfile = await getUserProfileAdmin(userId); 
    if (!userProfile) return { success: false, error: "User profile not found." };

    const newPostData: Omit<FeedPost, 'id' | 'createdAt'> & { createdAt: FieldValue } = {
      userId: userId,
      userName: userProfile.name || `User (${userId.substring(0,5)})`,
      userAvatarUrl: userProfile.avatarUrl,
      userRole: userProfile.role || 'user',
      userIsVerified: userProfile.isVerified || false,
      planId: validatedData.planId,
      planName: validatedData.planName,
      mediaUrl: validatedData.highlightImageUrl,
      text: validatedData.postText, 
      visibility: validatedData.visibility,
      likesCount: 0,
      likedBy: [],
      commentsCount: 0,
      sharesCount: 0,
      createdAt: FieldValue.serverTimestamp(),
    };

    const postRef = await firestoreAdmin.collection('feedPosts').add(newPostData);
    revalidatePath('/feed');
    revalidatePath(`/plans/${validatedData.planId}`); 
    revalidatePath(`/users/${userId}`); 
    return { success: true, postId: postRef.id };
  } catch (error: any) {
    console.error("[createFeedPostAction] Error creating feed post:", error);
    return { success: false, error: error.message || "Could not create feed post." };
  }
}

export async function fetchFeedPostsAction(
  currentUserId?: string | null,
  limitCount: number = 20,
  lastPostCreatedAt?: string // New parameter
): Promise<{ success: boolean; posts?: FeedPost[]; error?: string; nextCursor?: string }> {
  try {
    // Assuming getFeedPostsAdminService is updated to handle forUserId correctly,
    // if forUserId is not part of this specific action, we pass undefined or ensure the service handles it.
    // For now, let's assume the main feed doesn't use forUserId here, it's for profiles.
    const { posts, nextCursor } = await getFeedPostsAdminService(currentUserId, limitCount, undefined, lastPostCreatedAt);
    return { success: true, posts, nextCursor };
  } catch (error: any) {
    return { success: false, error: error.message || "Could not fetch feed posts.", nextCursor: undefined };
  }
}

export async function toggleLikePostServerAction(
  postId: string,
  idToken: string
): Promise<{ 
  success: boolean; 
  updatedPostFields?: Partial<FeedPost>; // Keep this as partial for client-side optimistic updates
  error?: string; 
  errorCode?: string; 
  originalError?: string; 
}> {
  if (!authAdmin) return { success: false, error: "Server error: Auth service not available.", errorCode: "SERVER_CONFIG_ERROR" };
  let decodedToken;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
  } catch (error: any) {
    console.error("[toggleLikePostServerAction] ID Token verification error:", error);
    let e = 'Authentication failed. Invalid or expired token.';
    let eCode = "AUTH_ERROR";
    if (error.code === 'auth/id-token-expired') { e = 'Your session has expired. Please log in again.'; eCode = "AUTH_TOKEN_EXPIRED"; }
    else if (error.code === 'auth/argument-error') { e = 'Authentication token is malformed.'; eCode = "AUTH_MALFORMED_TOKEN"; }
    return { success: false, error: e, errorCode: eCode, originalError: error.message || String(error) };
  }
  const userId = decodedToken.uid;
  
  try {
    const result = await toggleLikePostAdmin(postId, userId);
    if (result.success && result.updatedPost) {
      revalidatePath('/feed'); 
      // Return only specific fields needed for client-side optimistic update consistency
      return { 
        success: true, 
        updatedPostFields: { 
          likesCount: result.updatedPost.likesCount, 
          likedBy: result.updatedPost.likedBy 
        } 
      };
    }
    // If not successful, result already contains error, errorCode, originalError
    return result; 
  } catch (error: any) { // Should ideally not be reached if toggleLikePostAdmin handles its errors
    console.error("[toggleLikePostServerAction] Unexpected error calling toggleLikePostAdmin:", error);
    return { success: false, error: "An unexpected server error occurred while toggling like.", errorCode: "UNEXPECTED_SERVER_ERROR", originalError: error.message || String(error) };
  }
}

export async function addCommentToPostServerAction(
  postId: string,
  text: string,
  idToken: string
): Promise<{ 
  success: boolean; 
  comment?: FeedComment; 
  updatedPostFields?: Partial<FeedPost>; // Keep this as partial
  error?: string; 
  errorCode?: string; 
  originalError?: string; 
}> {
  if (!authAdmin) return { success: false, error: "Server error: Auth service not available.", errorCode: "SERVER_CONFIG_ERROR" };
  let decodedToken;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
  } catch (error: any) {
    console.error("[addCommentToPostServerAction] ID Token verification error:", error);
    let e = 'Authentication failed. Invalid or expired token.';
    let eCode = "AUTH_ERROR";
    if (error.code === 'auth/id-token-expired') { e = 'Your session has expired. Please log in again.'; eCode = "AUTH_TOKEN_EXPIRED"; }
    else if (error.code === 'auth/argument-error') { e = 'Authentication token is malformed.'; eCode = "AUTH_MALFORMED_TOKEN"; }
    return { success: false, error: e, errorCode: eCode, originalError: error.message || String(error) };
  }
  const userId = decodedToken.uid;

  if (!text.trim()) return { success: false, error: "Comment cannot be empty.", errorCode: "VALIDATION_ERROR" };

  try {
    const userProfile = await getUserProfileAdmin(userId);
    if (!userProfile) return { success: false, error: "User profile not found.", errorCode: "USER_PROFILE_NOT_FOUND" };

    const commentDataForService: Omit<FeedComment, 'id' | 'createdAt'> = {
      postId,
      userId,
      userName: userProfile.name,
      userAvatarUrl: userProfile.avatarUrl,
      text: text.trim(),
    };
    
    const result = await addCommentToPostAdminService(postId, commentDataForService);
    if (result.success && result.comment && result.updatedPost) {
      revalidatePath('/feed');
      return { 
        success: true, 
        comment: result.comment, 
        updatedPostFields: { // Return only necessary fields
          commentsCount: result.updatedPost.commentsCount,
          // updatedAt: result.updatedPost.updatedAt // If needed by client
        }
      };
    }
    return result; // Propagate error details from service
  } catch (error: any) { // Should ideally not be reached
    console.error("[addCommentToPostServerAction] Unexpected error:", error);
    return { success: false, error: "An unexpected server error occurred while adding comment.", errorCode: "UNEXPECTED_SERVER_ERROR", originalError: error.message || String(error) };
  }
}

export async function incrementPostSharesAction(
  postId: string, 
  idToken: string
): Promise<{ 
  success: boolean; 
  updatedPostFields?: Partial<FeedPost>; // Keep this as partial
  error?: string; 
  errorCode?: string; 
  originalError?: string; 
}> {
  if (!authAdmin) return { success: false, error: "Server error: Auth service not available.", errorCode: "SERVER_CONFIG_ERROR" };
  try {
    await authAdmin.verifyIdToken(idToken); 
  } catch (error: any) {
    console.error("[incrementPostSharesAction] ID Token verification error:", error);
    let e = 'Authentication failed. Invalid or expired token.';
    let eCode = "AUTH_ERROR";
    if (error.code === 'auth/id-token-expired') { e = 'Your session has expired. Please log in again.'; eCode = "AUTH_TOKEN_EXPIRED"; }
    else if (error.code === 'auth/argument-error') { e = 'Authentication token is malformed.'; eCode = "AUTH_MALFORMED_TOKEN"; }
    return { success: false, error: e, errorCode: eCode, originalError: error.message || String(error) };
  }

  try {
    const result = await incrementPostSharesAdminService(postId);
    if (result.success && result.updatedPost) {
      revalidatePath('/feed');
      return { 
        success: true, 
        updatedPostFields: { // Return only necessary fields
          sharesCount: result.updatedPost.sharesCount,
          // updatedAt: result.updatedPost.updatedAt // If needed
        }
      };
    }
    return result; // Propagate error details
  } catch (error: any) { // Should ideally not be reached
    console.error("[incrementPostSharesAction] Unexpected error:", error);
    return { success: false, error: "An unexpected server error occurred while updating share count.", errorCode: "UNEXPECTED_SERVER_ERROR", originalError: error.message || String(error) };
  }
}

export async function deleteFeedPostAction(
  postId: string, 
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  if (!authAdmin) return { success: false, error: "Server error: Auth service not available." };
  let decodedToken;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
  } catch (error: any) {
    console.error("[deleteFeedPostAction] ID Token verification error:", error);
    let e = 'Authentication failed.';
    if (error.code === 'auth/id-token-expired') e = 'Session expired.';
    return { success: false, error: e };
  }
  const requestingUserId = decodedToken.uid;

  try {
    const result = await deleteFeedPostAdminService(postId, requestingUserId);
    if (result.success) revalidatePath('/feed');
    return result;
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to delete post." };
  }
}
