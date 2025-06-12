
// src/services/chatService.server.ts
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { Chat, ChatMessage, ChatParticipantInfo, ChatType, UserProfile, UserRoleType } from '@/types/user';
import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';

const CHATS_COLLECTION = 'chats';
const MESSAGES_SUBCOLLECTION = 'messages';

interface ProcessedBasicUserInfoForChat {
  uid: string;
  name: string; 
  avatarUrl: string | null;
  role: UserRoleType | null;
  isVerified: boolean;
}

export const createDirectChatAdmin = async (
  currentUserProcessedInfo: ProcessedBasicUserInfoForChat,
  friendProcessedInfo: ProcessedBasicUserInfoForChat
): Promise<string> => {
  if (!firestoreAdmin) {
    console.error("[createDirectChatAdmin] Firestore Admin SDK is not initialized.");
    throw new Error("Firestore Admin SDK not available");
  }
  console.log(`[createDirectChatAdmin] Creating chat between ${currentUserProcessedInfo.uid} and ${friendProcessedInfo.uid}`);

  const participantsArray = [currentUserProcessedInfo.uid, friendProcessedInfo.uid].sort();
  const now = FieldValue.serverTimestamp();

  const participantInfo: ChatParticipantInfo[] = [
    { 
      uid: currentUserProcessedInfo.uid, 
      name: currentUserProcessedInfo.name, 
      avatarUrl: currentUserProcessedInfo.avatarUrl,
      role: currentUserProcessedInfo.role,
      isVerified: currentUserProcessedInfo.isVerified
    },
    { 
      uid: friendProcessedInfo.uid, 
      name: friendProcessedInfo.name, 
      avatarUrl: friendProcessedInfo.avatarUrl,
      role: friendProcessedInfo.role,
      isVerified: friendProcessedInfo.isVerified
    },
  ];
  
  const initialReadTimestamps: { [userId: string]: AdminTimestamp } = {};

  try {
    const newChatDocRef = await firestoreAdmin.collection(CHATS_COLLECTION).add({
      participants: participantsArray,
      participantInfo,
      type: 'direct' as ChatType,
      createdAt: now,
      updatedAt: now,
      lastMessageText: '', 
      lastMessageSenderId: '',
      lastMessageTimestamp: null,
      participantReadTimestamps: initialReadTimestamps, 
    });
    console.log('[createDirectChatAdmin] Direct chat created successfully with ID (Admin SDK):', newChatDocRef.id);
    return newChatDocRef.id;
  } catch (error) {
    console.error('[createDirectChatAdmin] Error creating direct chat (Admin SDK):', error);
    throw error;
  }
};

export const getExistingDirectChatIdAdmin = async (
  currentUserUid: string,
  friendUid: string
): Promise<string | null> => {
  if (!firestoreAdmin) {
    console.error("[getExistingDirectChatIdAdmin] Firestore Admin SDK is not initialized.");
    throw new Error("Firestore Admin SDK not available");
  }
  console.log(`[getExistingDirectChatIdAdmin] Checking for existing chat between ${currentUserUid} and ${friendUid}`);
  const participantsArray = [currentUserUid, friendUid].sort();
  const chatsRef = firestoreAdmin.collection(CHATS_COLLECTION);
  const q = chatsRef
    .where('type', '==', 'direct' as ChatType)
    .where('participants', '==', participantsArray)
    .limit(1);
  try {
    const querySnapshot = await q.get();
    if (!querySnapshot.empty) {
      console.log(`[getExistingDirectChatIdAdmin] Existing chat found: ${querySnapshot.docs[0].id}`);
      return querySnapshot.docs[0].id;
    }
    console.log(`[getExistingDirectChatIdAdmin] No existing chat found.`);
    return null;
  } catch (error) {
    console.error('[getExistingDirectChatIdAdmin] Error in getExistingDirectChatIdAdmin (Admin SDK):', error);
    throw error;
  }
};

export const deleteChatAdmin = async (chatId: string, requestingUserId: string): Promise<void> => {
  if (!firestoreAdmin) {
    console.error("[deleteChatAdmin] Firestore Admin SDK is not initialized.");
    throw new Error("Firestore Admin SDK not available");
  }
  console.log(`[deleteChatAdmin] Attempting to delete chat ${chatId} by user ${requestingUserId}`);
  const chatDocRef = firestoreAdmin.collection(CHATS_COLLECTION).doc(chatId);
  try {
    const chatDocSnap = await chatDocRef.get();
    if (!chatDocSnap.exists) {
      console.warn(`[deleteChatAdmin] Chat not found: ${chatId}. Skipping deletion.`);
      return;
    }
    const chatData = chatDocSnap.data();
    if (!chatData?.participants?.includes(requestingUserId)) {
        console.warn(`[deleteChatAdmin] User ${requestingUserId} is not a participant of chat ${chatId}. Deletion denied by application logic.`);
        throw new Error("User not authorized to delete this chat.");
    }

    const messagesCollectionRef = chatDocRef.collection(MESSAGES_SUBCOLLECTION);
    const messagesSnapshot = await messagesCollectionRef.limit(500).get(); 
    let batch = firestoreAdmin.batch();
    let count = 0;
    for (const doc of messagesSnapshot.docs) {
        batch.delete(doc.ref);
        count++;
        if (count >= 499) { 
            await batch.commit();
            batch = firestoreAdmin.batch();
            count = 0;
        }
    }
    if (count > 0) {
        await batch.commit();
    }
    console.log(`[deleteChatAdmin] Deleted ${messagesSnapshot.docs.length} messages for chat ${chatId}.`);
    await chatDocRef.delete();
    console.log(`[deleteChatAdmin] Chat ${chatId} deleted successfully by user ${requestingUserId}.`);
  } catch (error) {
    console.error(`[deleteChatAdmin] Error deleting chat ${chatId} (Admin SDK):`, error);
    throw error;
  }
};

export const sendMessageAdmin = async (
  chatId: string,
  senderId: string,
  text?: string | null,
  mediaUrl?: string | null,
  mediaContentType?: string | null 
): Promise<void> => {
  if (!firestoreAdmin) {
    console.error("[sendMessageAdmin] Firestore Admin SDK is not initialized.");
    throw new Error("Firestore Admin SDK not available");
  }
   if ((!text || !text.trim()) && !mediaUrl) {
    console.error("[sendMessageAdmin] Message text or mediaUrl must be provided.");
    throw new Error("Message text or mediaUrl must be provided.");
  }
  console.log(`[sendMessageAdmin] Received parameters: chatId=${chatId}, senderId=${senderId}, text=${text ? text.substring(0,20)+"..." : 'N/A'}, mediaUrl=${mediaUrl}, mediaContentType=${mediaContentType}`);

  try {
    const chatDocRef = firestoreAdmin.collection(CHATS_COLLECTION).doc(chatId);
    const messagesSubCollectionRef = chatDocRef.collection(MESSAGES_SUBCOLLECTION);
    const nowServerTimestamp = FieldValue.serverTimestamp();

    const batch = firestoreAdmin.batch();

    const messagePayload: Partial<ChatMessage> & { timestamp: FirebaseFirestore.FieldValue } = {
      senderId,
      timestamp: nowServerTimestamp,
      hiddenBy: [], // Initialize hiddenBy as empty array
    };

    if (text && typeof text === 'string' && text.trim()) {
      messagePayload.text = text.trim();
    }

    if (mediaUrl && typeof mediaUrl === 'string') {
      messagePayload.mediaUrl = mediaUrl;
      if (mediaContentType && typeof mediaContentType === 'string') {
        messagePayload.mediaContentType = mediaContentType;
      }
    } else if (mediaUrl && typeof mediaUrl !== 'string') {
         console.error(`[sendMessageAdmin] CRITICAL: mediaUrl was provided but is not a string. Type: ${typeof mediaUrl}. NOT including in payload.`);
    }
    
    console.log('[sendMessageAdmin] Final messagePayload for Firestore:', JSON.stringify(messagePayload));

    const newMessageDocRef = messagesSubCollectionRef.doc(); 
    batch.set(newMessageDocRef, messagePayload);

    const chatUpdateData: any = {
      lastMessageText: messagePayload.text ? messagePayload.text : (messagePayload.mediaUrl ? "[Image]" : "Message sent"),
      lastMessageSenderId: senderId,
      lastMessageTimestamp: nowServerTimestamp,
      updatedAt: nowServerTimestamp,
      [`participantReadTimestamps.${senderId}`]: nowServerTimestamp, 
    };
    batch.update(chatDocRef, chatUpdateData);

    await batch.commit();
    console.log(`[sendMessageAdmin] Message successfully sent to chat ${chatId} by ${senderId}`);
  } catch (error) {
    console.error(`[sendMessageAdmin] Error sending message to chat ${chatId}:`, error);
    throw error;
  }
};

export const markChatAsFullyReadAdmin = async (
  chatId: string,
  userId: string
): Promise<void> => {
  if (!firestoreAdmin) {
    console.error("[markChatAsFullyReadAdmin] Firestore Admin SDK is not initialized.");
    throw new Error("Firestore Admin SDK not available");
  }
  console.log(`[markChatAsFullyReadAdmin] Marking chat ${chatId} as read for user ${userId}.`);
  try {
    const chatDocRef = firestoreAdmin.collection(CHATS_COLLECTION).doc(chatId);
    const now = FieldValue.serverTimestamp(); 
    await chatDocRef.update({
      [`participantReadTimestamps.${userId}`]: now,
      updatedAt: now, 
    });
    console.log(`[markChatAsFullyReadAdmin] Chat ${chatId} marked as read for user ${userId} successfully.`);
  } catch (error) {
    console.error(`[markChatAsFullyReadAdmin] Error marking chat ${chatId} as read for user ${userId}:`, error);
    throw error;
  }
};

export const hideMessageForUserAdmin = async (chatId: string, messageId: string, userId: string): Promise<void> => {
  if (!firestoreAdmin) {
    console.error("[hideMessageForUserAdmin] Firestore Admin SDK is not initialized.");
    throw new Error("Firestore Admin SDK not available");
  }
  console.log(`[hideMessageForUserAdmin] User ${userId} hiding message ${messageId} in chat ${chatId}.`);
  try {
    const messageDocRef = firestoreAdmin.collection(CHATS_COLLECTION).doc(chatId).collection(MESSAGES_SUBCOLLECTION).doc(messageId);
    
    // Atomically add the userId to the 'hiddenBy' array.
    // If 'hiddenBy' doesn't exist, it will be created.
    await messageDocRef.update({
      hiddenBy: FieldValue.arrayUnion(userId)
    });
    
    // Optionally, update the parent chat's 'updatedAt' if hiding a message should count as activity.
    // For now, let's assume hiding doesn't change the chat's main 'updatedAt'.
    // const chatDocRef = firestoreAdmin.collection(CHATS_COLLECTION).doc(chatId);
    // await chatDocRef.update({ updatedAt: FieldValue.serverTimestamp() });

    console.log(`[hideMessageForUserAdmin] Message ${messageId} successfully marked as hidden for user ${userId}.`);
  } catch (error) {
    console.error(`[hideMessageForUserAdmin] Error hiding message ${messageId} for user ${userId}:`, error);
    throw error;
  }
};
