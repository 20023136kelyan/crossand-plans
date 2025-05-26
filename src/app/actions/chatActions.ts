
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
import { authAdmin, storageAdmin } from '@/lib/firebaseAdmin'; 
import { FieldValue } from 'firebase-admin/firestore';

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
  if (!storageAdmin) {
    console.error("[sendMessageAction] Firebase Admin Storage service not available.");
    return { success: false, error: "Server error: Storage service not available." };
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
  
  if ((!text || !text.trim()) && !imageFile) {
    return { success: false, error: 'Message must contain text or an image.' };
  }

  let mediaUrlForService: string | null = null;
  let determinedContentType: string | null = null;

  if (imageFile) {
    console.log(`[sendMessageAction] Received image. Name: ${imageFile.name}, Client-side Type: ${imageFile.type}, Size: ${imageFile.size}`);
    
    if (imageFile.size > 5 * 1024 * 1024) { // 5MB limit
      console.error(`[sendMessageAction] Image too large: ${imageFile.size} bytes.`);
      return { success: false, error: "Image size should not exceed 5MB." };
    }
    
    determinedContentType = imageFile.type; 
    if (!determinedContentType || !determinedContentType.startsWith('image/')) {
      console.warn(`[sendMessageAction] Client-side type '${imageFile.type}' for ${imageFile.name} is invalid/missing. Inferring from extension.`);
      determinedContentType = getMimeTypeFromServer(imageFile.name);
    }

    if (!determinedContentType || !determinedContentType.startsWith('image/')) {
      console.error(`[sendMessageAction] Could not determine a valid image Content-Type for ${imageFile.name}. Client-provided: '${imageFile.type}', Inferred: '${determinedContentType}'.`);
      return { success: false, error: `Invalid file type for ${imageFile.name}. Please select standard image (JPG, PNG, GIF, WEBP, etc).` };
    }
    console.log(`[sendMessageAction] Using Content-Type: '${determinedContentType}' for ${imageFile.name} for upload.`);

    try {
      const bucketNameForAction = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      let bucket;
      if (typeof storageAdmin.bucket !== 'function') {
        console.error("[sendMessageAction] storageAdmin.bucket is not a function!");
        return { success: false, error: "Server error: Storage service misconfiguration."};
      }
      if (bucketNameForAction) {
        bucket = storageAdmin.bucket(bucketNameForAction);
      } else {
        bucket = storageAdmin.bucket(); 
      }
      if (!bucket) {
        console.error("[sendMessageAction] Could not access Firebase Storage bucket.");
        return { success: false, error: 'Server error: Storage bucket not accessible.' };
      }
      const bucketName = bucket.name;
      console.log(`[sendMessageAction] Using bucket: ${bucketName}`);
      
      const originalName = imageFile.name;
      const extension = originalName.split('.').pop()?.toLowerCase() || '';
      const baseName = extension ? originalName.substring(0, originalName.lastIndexOf(`.${extension}`)) : originalName;
      const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize
      const sanitizedFileName = extension ? `${sanitizedBaseName}.${extension}` : sanitizedBaseName;

      const fileName = `chat_media/${chatId}/${senderId}/${Date.now()}-${sanitizedFileName}`;
      const blob = bucket.file(fileName);
      
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      console.log(`[sendMessageAction] Uploading ${fileName} with Content-Type: ${determinedContentType}`);
      await blob.save(buffer, {
        metadata: { contentType: determinedContentType, cacheControl: 'public, max-age=31536000', customMetadata: { uploaderUid: senderId }},
        public: true, 
      });
      
      mediaUrlForService = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      console.log(`[sendMessageAction] Image uploaded. URL: ${mediaUrlForService}`);

    } catch (storageError: any) {
      console.error(`[sendMessageAction] Firebase Storage upload error for chat ${chatId}:`, storageError);
      return { success: false, error: `Storage upload error: ${storageError.message || 'Unknown storage error'}` };
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
): Promise<{ success: boolean; error?: string }> {
  if (!authAdmin) {
    console.error("[markChatAsReadAction] Firebase Admin Auth service not available.");
    return { success: false, error: "Server error: Auth service not available." };
  }
  if (!idToken) return { success: false, error: 'Authentication token missing.' };
  if (!chatId) return { success: false, error: 'Chat ID is missing.' };

  let decodedToken;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
  } catch (authError: any) {
    console.error(`[markChatAsReadAction] ID token verification failed for chat ${chatId}:`, authError);
    let specificError = 'Authentication failed. Invalid or expired token.';
    if (authError.code === 'auth/id-token-expired') {
      specificError = 'Your session has expired. Please log in again.';
    }
    return { success: false, error: specificError };
  }
  const userId = decodedToken.uid;

  try {
    await markChatAsFullyReadAdminService(chatId, userId);
    revalidatePath('/messages'); 
    revalidatePath(`/messages/${chatId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[markChatAsReadAction] Error marking chat ${chatId} as read for user ${userId}:`, error);
    return { success: false, error: error.message || 'Failed to mark chat as read.' };
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
