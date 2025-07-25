
// src/app/actions/chatActions.ts
'use server';

import {
  createDirectChatAdmin,
  getExistingDirectChatIdAdmin,
  sendMessageAdmin as sendMessageAdminService,
  markChatAsFullyReadAdmin as markChatAsFullyReadAdminService,
  deleteChatAdmin as deleteChatAdminService,
  hideMessageForUserAdmin as hideMessageForUserAdminService, // New import
} from '@/services/chatService.server';
import { getUserProfileAdmin } from '@/services/userService.server';
import type { ChatParticipantInfo, UserProfile, UserRoleType } from '@/types/user';
import { revalidatePath } from 'next/cache';
import { authAdmin, firestoreAdmin } from '@/lib/firebaseAdmin'; 
import { FieldValue } from 'firebase-admin/firestore';
import { uploadChatMessage } from '@/lib/postingSystem';

interface RawBasicUserInfo {
  uid: string;
  name: string | null;
  avatarUrl: string | null;
}

interface ProcessedBasicUserInfoForChat {
  uid: string;
  name: string;
  avatarUrl: string | null;
  role: UserRoleType | null;
  isVerified: boolean;
}

const getMimeTypeFromServer = (fileName: string): string | null => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension) {
    console.warn(`[getMimeTypeFromServer] No extension found for file: ${fileName}`);
    return null;
  }
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
  };
  const type = mimeTypes[extension];
  if (!type) {
    console.warn(`[getMimeTypeFromServer] Unknown extension: .${extension} for file: ${fileName}`);
  }
  return type || null; 
};


export async function initiateDirectChatAction(
  friendRawInfo: RawBasicUserInfo,
  currentUserRawInfo: RawBasicUserInfo
): Promise<{ success: boolean; chatId?: string; error?: string }> {
  if (!authAdmin) {
    return { success: false, error: "Authentication service not available." };
  }
  if (!currentUserRawInfo?.uid || !friendRawInfo?.uid) {
    return { success: false, error: 'User or friend data is missing for initiating chat.' };
  }
  if (currentUserRawInfo.uid === friendRawInfo.uid) {
    return { success: false, error: 'Cannot initiate chat with yourself.' };
  }

  try {
    const [currentUserFullProfile, friendFullProfile] = await Promise.all([
      getUserProfileAdmin(currentUserRawInfo.uid),
      getUserProfileAdmin(friendRawInfo.uid)
    ]);

    if (!currentUserFullProfile) return { success: false, error: 'Current user profile not found.' };
    if (!friendFullProfile) return { success: false, error: 'Friend user profile not found.' };
    
    const uidPrefix = (uid: string) => uid.substring(0, 5);

    const currentUserProcessedInfo: ProcessedBasicUserInfoForChat = {
      uid: currentUserFullProfile.uid,
      name: currentUserFullProfile.name || `User (${uidPrefix(currentUserFullProfile.uid)})`,
      avatarUrl: currentUserFullProfile.avatarUrl,
      role: currentUserFullProfile.role,
      isVerified: currentUserFullProfile.isVerified
    };
    const friendProcessedInfo: ProcessedBasicUserInfoForChat = {
      uid: friendFullProfile.uid,
      name: friendFullProfile.name || `User (${uidPrefix(friendFullProfile.uid)})`,
      avatarUrl: friendFullProfile.avatarUrl,
      role: friendFullProfile.role,
      isVerified: friendFullProfile.isVerified
    };

    let chatId = await getExistingDirectChatIdAdmin(currentUserProcessedInfo.uid, friendProcessedInfo.uid);
    if (!chatId) {
      chatId = await createDirectChatAdmin(currentUserProcessedInfo, friendProcessedInfo);
    }

    if (chatId) {
      // Add a small delay to ensure the chat document is fully written to Firestore
      await new Promise(resolve => setTimeout(resolve, 500));
      revalidatePath('/messages');
      revalidatePath(`/messages/${chatId}`);
      return { success: true, chatId };
    } else {
      return { success: false, error: 'Failed to create or retrieve chat ID.' };
    }
  } catch (error: any) {
    console.error('[initiateDirectChatAction] Error:', error);
    return { success: false, error: error.message || 'Failed to initiate direct chat.' };
  }
}


export async function sendMessageAction(
  chatId: string,
  formData: FormData,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  console.log('[sendMessageAction] Action started.');
  if (!authAdmin) {
    console.error("[sendMessageAction] Firebase Admin Auth service not available.");
    return { success: false, error: "Server error: Authentication service not available." };
  }


  if (!idToken) return { success: false, error: 'Authentication token missing.' };
  if (!chatId) return { success: false, error: 'Chat ID is missing.' };
  
  let decodedToken;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
  } catch (authError: any) {
    console.error(`[sendMessageAction] ID token verification failed for chat ${chatId}:`, authError);
    let specificError = 'Authentication failed. Invalid or expired token.';
    if (authError.code === 'auth/id-token-expired') {
      specificError = 'Your session has expired. Please log in again.';
    }
    return { success: false, error: specificError };
  }
  const senderId = decodedToken.uid;
  console.log(`[sendMessageAction] User ${senderId} verified.`);

  const text = formData.get('text') as string | null;
  const imageFile = formData.get('image') as File | null;
  const mediaUrl = formData.get('mediaUrl') as string | null;
  const isGif = formData.get('isGif') === 'true';
  
  if ((!text || !text.trim()) && !imageFile && !mediaUrl) {
    return { success: false, error: 'Message must contain text or an image.' };
  }

  let mediaUrlForService: string | null = mediaUrl || null;
  let determinedContentType: string | null = isGif ? 'image/gif' : null;

  // If we have a direct media URL (like a GIF), use that
  if (mediaUrl) {
    console.log(`[sendMessageAction] Using provided media URL: ${mediaUrl}`);
  } 
  // Otherwise, handle file upload if present
  else if (imageFile) {
    console.log(`[sendMessageAction] Received image. Name: ${imageFile.name}, Client-side Type: ${imageFile.type}, Size: ${imageFile.size}`);
    
    // Upload image using centralized posting system
    try {
      const uploadResult = await uploadChatMessage(imageFile, senderId, idToken, chatId);
      if (uploadResult.success) {
        mediaUrlForService = uploadResult.data?.url || null;
        console.log(`[sendMessageAction] Image uploaded. URL: ${mediaUrlForService}`);
      } else {
        console.error(`[sendMessageAction] Image upload failed for chat ${chatId}:`, uploadResult.error);
        return { success: false, error: `Failed to upload image: ${uploadResult.error}` };
      }
    } catch (uploadError: any) {
      console.error(`[sendMessageAction] Image upload error for chat ${chatId}:`, uploadError);
      return { success: false, error: `Failed to upload image: ${uploadError.message || 'Unknown upload error'}` };
    }
  }
  
  const finalMediaUrl = (typeof mediaUrlForService === 'string' && mediaUrlForService.startsWith('https://')) ? mediaUrlForService : null;
  console.log(`[sendMessageAction] Calling sendMessageAdminService. Text: '${text ? text.substring(0,20)+"..." : 'N/A'}', MediaURL: ${finalMediaUrl}, ContentType: ${determinedContentType}`);

  try {
    await sendMessageAdminService(chatId, senderId, text, finalMediaUrl, determinedContentType); 
    revalidatePath(`/messages/${chatId}`);
    revalidatePath('/messages'); // To update last message in chat list
    return { success: true };
  } catch (error: any) {
    console.error(`[sendMessageAction] Error calling sendMessageAdminService or revalidating paths for chat ${chatId}:`, error);
    return { success: false, error: error.message || 'Failed to send message.' };
  }
}


export async function markChatAsReadAction(
  chatId: string,
  idToken: string
): Promise<{ 
  success: boolean; 
  error?: string; 
  message?: string;
  details?: any;
}> {
  console.log(`[markChatAsReadAction] Starting to mark chat ${chatId} as read`);
  
  if (!authAdmin) {
    const errorMsg = "Firebase Admin Auth service not available.";
    console.error(`[markChatAsReadAction] ${errorMsg}`);
    return { success: false, error: `Server error: ${errorMsg}` };
  }
  
  if (!idToken) {
    const errorMsg = 'Authentication token missing.';
    console.error(`[markChatAsReadAction] ${errorMsg}`);
    return { success: false, error: errorMsg }; 
  }
  
  if (!chatId) {
    const errorMsg = 'Chat ID is missing.';
    console.error(`[markChatAsReadAction] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  let decodedToken;
  try {
    console.log(`[markChatAsReadAction] Verifying ID token for chat ${chatId}`);
    decodedToken = await authAdmin.verifyIdToken(idToken);
    console.log(`[markChatAsReadAction] Successfully verified ID token for user ${decodedToken.uid}`);
  } catch (authError: any) {
    const errorDetails = {
      code: authError.code,
      message: authError.message,
      stack: authError.stack
    };
    console.error(`[markChatAsReadAction] ID token verification failed for chat ${chatId}:`, errorDetails);
    
    let specificError = 'Authentication failed. Invalid or expired token.';
    if (authError.code === 'auth/id-token-expired') {
      specificError = 'Your session has expired. Please log in again.';
    }
    return { 
      success: false, 
      error: specificError,
      details: errorDetails
    };
  }
  
  const userId = decodedToken.uid;
  console.log(`[markChatAsReadAction] Proceeding with user ${userId} for chat ${chatId}`);

  try {
    console.log(`[markChatAsReadAction] Calling markChatAsFullyReadAdminService for chat ${chatId}`);
    await markChatAsFullyReadAdminService(chatId, userId);
    console.log(`[markChatAsReadAction] Successfully marked chat ${chatId} as read for user ${userId}`);
    
    console.log(`[markChatAsReadAction] Revalidating paths for chat ${chatId}`);
    try {
      revalidatePath('/messages');
      revalidatePath(`/messages/${chatId}`);
      console.log(`[markChatAsReadAction] Successfully revalidated paths for chat ${chatId}`);
    } catch (revalidateError) {
      console.error(`[markChatAsReadAction] Error revalidating paths for chat ${chatId}:`, revalidateError);
      // Don't fail the whole operation if revalidation fails
    }
    
    return { 
      success: true,
      message: `Successfully marked chat ${chatId} as read`
    };
  } catch (error: any) {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: (error as any).code
    };
    
    console.error(`[markChatAsReadAction] Error marking chat ${chatId} as read for user ${userId}:`, errorDetails);
    
    return { 
      success: false, 
      error: 'Failed to mark chat as read.',
      details: errorDetails
    };
  }
}

export async function deleteChatAction(
  chatId: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
   if (!authAdmin) {
    console.error("[deleteChatAction] Firebase Admin Auth service not available.");
    return { success: false, error: "Server error: Auth service not available." };
  }
  if (!idToken) return { success: false, error: 'Authentication token missing.' };
  if (!chatId) return { success: false, error: 'Chat ID is missing.' };

  let decodedToken;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
  } catch (authError: any) {
    console.error(`[deleteChatAction] ID token verification failed for chat ${chatId}:`, authError);
    let specificError = 'Authentication failed. Invalid or expired token.';
    if (authError.code === 'auth/id-token-expired') {
      specificError = 'Your session has expired. Please log in again.';
    }
    return { success: false, error: specificError };
  }
  const requestingUserId = decodedToken.uid;

  try {
    await deleteChatAdminService(chatId, requestingUserId);
    revalidatePath('/messages');
    return { success: true };
  } catch (error: any) {
    console.error(`[deleteChatAction] Error deleting chat ${chatId}:`, error);
    return { success: false, error: error.message || 'Failed to delete chat.' };
  }
}

export async function hideMessageForUserAction(
  chatId: string,
  messageId: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  if (!authAdmin) {
    console.error("[hideMessageForUserAction] Firebase Admin Auth service not available.");
    return { success: false, error: "Server error: Auth service not available." };
  }
  if (!idToken) return { success: false, error: "Authentication token missing." };
  if (!chatId || !messageId) return { success: false, error: "Chat ID or Message ID missing." };

  let decodedToken;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
  } catch (authError: any) {
    console.error(`[hideMessageForUserAction] ID token verification failed:`, authError);
    let specificError = 'Authentication failed. Invalid or expired token.';
    if (authError.code === 'auth/id-token-expired') {
      specificError = 'Your session has expired. Please log in again.';
    }
    return { success: false, error: specificError };
  }
  const userId = decodedToken.uid;

  try {
    await hideMessageForUserAdminService(chatId, messageId, userId);
    revalidatePath(`/messages/${chatId}`); // Revalidate specific chat to reflect hidden state
    return { success: true };
  } catch (error: any) {
    console.error(`[hideMessageForUserAction] Error hiding message:`, error);
    return { success: false, error: error.message || "Failed to hide message." };
  }
}
