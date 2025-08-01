
// src/services/chatService.server.ts
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { Chat, ChatMessage, ChatMessageCreate, ChatParticipantInfo, ChatType, UserProfile, UserRoleType } from '@/types/user';
import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { FirebaseQueryBuilder, COLLECTIONS, SUBCOLLECTIONS } from '@/lib/data/core/QueryBuilder';
import { getUserProfileAdmin } from '@/services/userService.server';
import { createNotification } from '@/services/notificationService.server';
import { markNotificationAsRead } from '@/services/notificationService.server';

// Legacy constants for backward compatibility
const CHATS_COLLECTION = COLLECTIONS.CHATS;
const MESSAGES_SUBCOLLECTION = SUBCOLLECTIONS.MESSAGES;

interface ProcessedBasicUserInfoForChat {
  uid: string;
  name: string; 
  username?: string; // Added to match ChatParticipantInfo interface
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
  

  const participantsArray = [currentUserProcessedInfo.uid, friendProcessedInfo.uid].sort();
  const now = FieldValue.serverTimestamp();

  const participantInfo: ChatParticipantInfo[] = [
    { 
      uid: currentUserProcessedInfo.uid, 
      name: currentUserProcessedInfo.name,
      username: currentUserProcessedInfo.username || '',
      avatarUrl: currentUserProcessedInfo.avatarUrl,
      role: currentUserProcessedInfo.role,
      isVerified: currentUserProcessedInfo.isVerified
    },
    { 
      uid: friendProcessedInfo.uid, 
      name: friendProcessedInfo.name,
      username: friendProcessedInfo.username || '',
      avatarUrl: friendProcessedInfo.avatarUrl,
      role: friendProcessedInfo.role,
      isVerified: friendProcessedInfo.isVerified
    },
  ];
  
  const initialReadTimestamps: { [userId: string]: AdminTimestamp } = {};

  try {
    const newChatDocRef = await FirebaseQueryBuilder.collection(COLLECTIONS.CHATS).add({
      participants: participantsArray,
      participantInfo,
      type: 'direct' as ChatType,
      createdAt: now,
      updatedAt: now,
      lastMessageText: '', 
      lastMessageSenderId: '',
      lastMessageTimestamp: now, // Changed from null to now
      participantReadTimestamps: initialReadTimestamps, 
    });
    
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

  
  const participantsArray = [currentUserUid, friendUid].sort();
  const q = FirebaseQueryBuilder.getFilteredQuery(COLLECTIONS.CHATS, {
    type: 'direct' as ChatType,
    participants: participantsArray
  }, { limit: 1 });
  try {
    const querySnapshot = await q.get();
    if (!querySnapshot.empty) {

      return querySnapshot.docs[0].id;
    }
    
    return null;
  } catch (error) {
    console.error('[getExistingDirectChatIdAdmin] Error in getExistingDirectChatIdAdmin (Admin SDK):', error);
    throw error;
  }
};

export const deleteChatAdmin = async (chatId: string, requestingUserId: string): Promise<void> => {
  
  const chatDocRef = FirebaseQueryBuilder.doc(COLLECTIONS.CHATS, chatId);
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
    let batch = firestoreAdmin!.batch();
    let count = 0;
    for (const doc of messagesSnapshot.docs) {
        batch.delete(doc.ref);
        count++;
        if (count >= 499) { 
            await batch.commit();
            batch = firestoreAdmin!.batch();
            count = 0;
        }
    }
    if (count > 0) {
        await batch.commit();
    }
    
    await chatDocRef.delete();
    
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
  mediaContentType?: string | null,
  voiceDuration?: number,
  replyToMessageId?: string
): Promise<void> => {
   if ((!text || !text.trim()) && !mediaUrl) {
    console.error("[sendMessageAdmin] Message text or mediaUrl must be provided.");
    throw new Error("Message text or mediaUrl must be provided.");
  }
  console.log(`[sendMessageAdmin] Received parameters: chatId=${chatId}, senderId=${senderId}, text=${text ? text.substring(0,20)+"..." : 'N/A'}, mediaUrl=${mediaUrl}, mediaContentType=${mediaContentType}`);

  try {
    const chatDocRef = FirebaseQueryBuilder.doc(COLLECTIONS.CHATS, chatId);
    const messagesSubCollectionRef = FirebaseQueryBuilder.subcollection(COLLECTIONS.CHATS, chatId, SUBCOLLECTIONS.MESSAGES);
    const nowServerTimestamp = FieldValue.serverTimestamp();

    const batch = firestoreAdmin!.batch();

    // Create message payload with server timestamp
    const messagePayload: ChatMessageCreate = {
      senderId,
      timestamp: nowServerTimestamp,
      hiddenBy: [], // Initialize hiddenBy as empty array
      readBy: {
        [senderId]: nowServerTimestamp // Sender has seen their own message
      },
      status: 'sent',
      updatedAt: nowServerTimestamp,
      // Thread metadata will be populated below if this is a reply
    };

    // Handle text content
    if (text && typeof text === 'string' && text.trim()) {
      messagePayload.text = text.trim();
    }

    // Handle reply and thread metadata
    if (replyToMessageId) {
      console.log(`[sendMessageAdmin] Processing reply to message ${replyToMessageId}`);
      
      // 1. Get the message being replied to
      const repliedMessageRef = FirebaseQueryBuilder.doc(COLLECTIONS.CHATS, chatId).collection(SUBCOLLECTIONS.MESSAGES).doc(replyToMessageId);
      const repliedMessageDoc = await repliedMessageRef.get();
      
      if (repliedMessageDoc.exists) {
        const repliedMessage = {
          id: repliedMessageDoc.id,
          ...repliedMessageDoc.data()
        } as ChatMessage;
        
        // Set basic reply info
        messagePayload.isReply = true;
        messagePayload.replyTo = {
          messageId: repliedMessage.id,
          senderId: repliedMessage.senderId,
          mediaUrl: repliedMessage.mediaUrl,
          mediaType: repliedMessage.mediaType
        };
        
        // Client will handle adding display fields like senderName and textPreview

        // Handle thread metadata
        if (repliedMessage.threadId) {
          // Replying to a message in an existing thread
          messagePayload.threadId = repliedMessage.threadId;
          messagePayload.parentId = repliedMessage.id;
          messagePayload.lineage = [...(repliedMessage.lineage || []), repliedMessage.id];
          messagePayload.isThreadRoot = false;
          
          // Update thread metadata on the root message
          const threadRootRef = FirebaseQueryBuilder.doc(COLLECTIONS.CHATS, chatId).collection(SUBCOLLECTIONS.MESSAGES).doc(repliedMessage.threadId);
          batch.update(threadRootRef, {
            lastThreadActivity: nowServerTimestamp,
            threadCount: FieldValue.increment(1),
            lastThreadMessagePreview: {
              text: messagePayload.text || '[Media]',
              senderId,
              timestamp: nowServerTimestamp
            }
          });
        } else {
          // Starting a new thread with this reply
          messagePayload.threadId = repliedMessage.id; // Root message is the first message in the thread
          messagePayload.parentId = repliedMessage.id;
          messagePayload.lineage = [repliedMessage.id];
          messagePayload.isThreadRoot = false;
          
          // Mark the original message as a thread root
          batch.update(repliedMessageRef, {
            isThreadRoot: true,
            threadCount: 2, // Original message + this reply
            lastThreadActivity: nowServerTimestamp,
            lastThreadMessagePreview: {
              text: messagePayload.text || '[Media]',
              senderId,
              timestamp: nowServerTimestamp
            }
          });
        }
      } else {
        console.warn(`[sendMessageAdmin] Replied message ${replyToMessageId} not found`);
      }
    }

    if (mediaUrl && typeof mediaUrl === 'string') {
      messagePayload.mediaUrl = mediaUrl;
      if (mediaContentType && typeof mediaContentType === 'string') {
        messagePayload.mediaContentType = mediaContentType;
        // Determine mediaType based on content type
        if (mediaContentType.startsWith('audio/')) {
          messagePayload.mediaType = 'voice';
          console.log('Server - voiceDuration received:', voiceDuration, 'type:', typeof voiceDuration);
          if (voiceDuration && !isNaN(voiceDuration)) {
            messagePayload.voiceDuration = voiceDuration;
            console.log('Server - setting voiceDuration in payload:', voiceDuration);
          } else {
            console.log('Server - voiceDuration not set, invalid value:', voiceDuration);
          }
        } else if (mediaContentType === 'image/gif') {
          messagePayload.mediaType = 'gif';
        } else if (mediaContentType.startsWith('image/')) {
          messagePayload.mediaType = 'image';
        } else if (mediaContentType.startsWith('video/')) {
          messagePayload.mediaType = 'video';
        } else {
          messagePayload.mediaType = 'file';
        }
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

    // --- Notification logic ---
    // Fetch chat participants
    const chatDocSnap = await chatDocRef.get();
    const chatData = chatDocSnap.data();
    if (!chatData || !Array.isArray(chatData.participants)) return;
    const recipients = chatData.participants.filter((uid: string) => uid !== senderId);
    if (recipients.length === 0) return;

    // Fetch sender profile
    const senderProfile = await getUserProfileAdmin(senderId);
    const senderName = senderProfile?.username || senderProfile?.firstName || senderProfile?.name || 'Someone';
    const senderAvatarUrl = senderProfile?.avatarUrl || undefined;
    // Message preview with better media type handling
    let messagePreview = text && text.trim() 
      ? text.trim().slice(0, 50) 
      : mediaUrl 
        ? mediaContentType?.startsWith('audio/') 
          ? '🎤 Voice message' 
          : mediaContentType === 'image/gif' 
            ? '🎬 GIF' 
            : mediaContentType?.startsWith('image/') 
              ? '🖼️ Image' 
              : mediaContentType?.startsWith('video/') 
                ? '🎥 Video' 
                : mediaContentType?.startsWith('application/') || mediaContentType?.startsWith('text/') 
                  ? '📄 File' 
                  : '📎 Attachment'
        : 'Message';

    // Create notification for each recipient
    await Promise.all(recipients.map(async (recipientId: string) => {
      try {
        // Check if recipient is currently active in the chat (typing or recently active)
        const typingStatusRef = FirebaseQueryBuilder.doc(COLLECTIONS.CHATS, chatId)
          .collection('typing')
          .doc('status');
          
        const typingStatusDoc = await typingStatusRef.get();
        const typingStatus = typingStatusDoc.data() || {};
        const recipientIsActive = typingStatus[recipientId] && 
          typingStatus[recipientId].timestamp && 
          (Date.now() - typingStatus[recipientId].timestamp.toDate().getTime() < 30000); // Active if typed in last 30 seconds
        
        // Only send notification if recipient is not active in the chat
        if (!recipientIsActive) {
          const notificationData: any = {
            type: 'chat_message',
            title: 'sent you a message',
            description: messagePreview,
            userName: senderName,
            chatId,
            senderId,
            senderName,
            messagePreview,
            actionUrl: `/messages/${chatId}`,
            isRead: false,
          };
          
          if (senderAvatarUrl) {
            notificationData.senderAvatarUrl = senderAvatarUrl;
          }
          
          await createNotification(recipientId, notificationData);
          console.log(`[sendMessageAdmin] Notification sent to ${recipientId} (inactive in chat)`);
        } else {
          console.log(`[sendMessageAdmin] Notification suppressed for ${recipientId} (active in chat)`);
        }
      } catch (error) {
        console.error(`[sendMessageAdmin] Error checking recipient ${recipientId} active status:`, error);
        // If there's an error checking status, send the notification to be safe
        const notificationData: any = {
          type: 'chat_message',
          title: 'sent you a message',
          description: messagePreview,
          userName: senderName,
          chatId,
          senderId,
          senderName,
          messagePreview,
          actionUrl: `/messages/${chatId}`,
          isRead: false,
        };
        
        if (senderAvatarUrl) {
          notificationData.senderAvatarUrl = senderAvatarUrl;
        }
        
        await createNotification(recipientId, notificationData);
      }
    }));
  } catch (error) {
    console.error(`[sendMessageAdmin] Error sending message to chat ${chatId}:`, error);
    throw error;
  }
};

export const markChatAsFullyReadAdmin = async (
  chatId: string,
  userId: string
): Promise<void> => {
  console.log(`[markChatAsFullyReadAdmin] Marking chat ${chatId} as read for user ${userId}.`);
  try {
    const chatDocRef = FirebaseQueryBuilder.doc(COLLECTIONS.CHATS, chatId);
    const now = FieldValue.serverTimestamp(); 
    
    // First, get the current chat to check last read timestamp
    const chatDoc = await chatDocRef.get();
    const chatData = chatDoc.data();
    const previousReadTimestamp = chatData?.participantReadTimestamps?.[userId];
    const previousReadTime = previousReadTimestamp ? 
      (typeof previousReadTimestamp.toDate === 'function' ? previousReadTimestamp.toDate() : previousReadTimestamp) : 
      new Date(0);
    
    // Update the chat's read timestamp for this user
    await chatDocRef.update({
      [`participantReadTimestamps.${userId}`]: now,
      updatedAt: now, 
    });
    
    // Mark all unread messages as read by this user
    const messagesRef = FirebaseQueryBuilder.subcollection(COLLECTIONS.CHATS, chatId, 'messages');
    let unreadMessagesQuery;
    
    if (previousReadTime) {
      unreadMessagesQuery = await messagesRef
        .where('timestamp', '>', previousReadTime instanceof Date ? 
          AdminTimestamp.fromDate(previousReadTime) : previousReadTime)
        .where('senderId', '!=', userId) // Only mark others' messages as read
        .get();
    } else {
      unreadMessagesQuery = await messagesRef
        .where('senderId', '!=', userId) // Only mark others' messages as read
        .get();
    }
    
    // Update each message with readBy information
    const batch = firestoreAdmin!.batch();
    let updatedCount = 0;
    
    for (const doc of unreadMessagesQuery.docs) {
      const messageData = doc.data() as ChatMessage;
      const messageRef = messagesRef.doc(doc.id);
      
      // Only update if not already read by this user
      if (!messageData.readBy?.[userId]) {
        const updateData: any = {
          [`readBy.${userId}`]: now,
          updatedAt: now
        };
        
        // Only update status to 'read' if it's currently 'sent' or undefined
        if (messageData.status === 'sent' || messageData.status === undefined) {
          updateData.status = 'read';
        }
        
        batch.update(messageRef, updateData);
        updatedCount++;
      }
    }
    
    if (updatedCount > 0) {
      try {
        await batch.commit();
        console.log(`[markChatAsFullyReadAdmin] Successfully committed batch update for ${updatedCount} messages for user ${userId}`);
      } catch (batchError) {
        console.error(`[markChatAsFullyReadAdmin] Batch commit error:`, batchError);
        throw new Error(`Failed to update read receipts: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`);
      }
    } else {
      console.log(`[markChatAsFullyReadAdmin] No messages needed to be marked as read for user ${userId}`);
    }
    
    // Mark all chat_message notifications for this chat as read
    const notificationsRef = FirebaseQueryBuilder.collection(COLLECTIONS.USERS).doc(userId).collection('notifications');
    const chatNotifQuery = await notificationsRef
      .where('type', '==', 'chat_message')
      .where('chatId', '==', chatId)
      .where('isRead', '==', false)
      .get();
    await Promise.all(chatNotifQuery.docs.map(doc => markNotificationAsRead(userId, doc.id)));
    
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

  const messageRef = FirebaseQueryBuilder.doc(COLLECTIONS.CHATS, chatId).collection(SUBCOLLECTIONS.MESSAGES).doc(messageId);
  
  try {
    await firestoreAdmin.runTransaction(async (transaction) => {
      const messageDoc = await transaction.get(messageRef);
      if (!messageDoc.exists) {
        throw new Error("Message not found");
      }

      const messageData = messageDoc.data() as ChatMessage;
      const hiddenBy = messageData.hiddenBy || [];
      
      if (!hiddenBy.includes(userId)) {
        transaction.update(messageRef, {
          hiddenBy: [...hiddenBy, userId],
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    });
  } catch (error) {
    console.error(`[hideMessageForUserAdmin] Error hiding message ${messageId} for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Fetches all messages in a thread
 * @param chatId The ID of the chat containing the thread
 * @param threadId The ID of the thread (messageId of the root message)
 * @param limit Maximum number of messages to return (default: 50)
 * @param lastVisible Last visible document for pagination
 */
export const getThreadMessages = async (
  chatId: string,
  threadId: string,
  limit: number = 50,
  lastVisible?: FirebaseFirestore.DocumentSnapshot
): Promise<{ messages: ChatMessage[]; lastVisible: FirebaseFirestore.DocumentSnapshot | null }> => {
  if (!firestoreAdmin) {
    console.error("[getThreadMessages] Firestore Admin SDK is not initialized.");
    throw new Error("Firestore Admin SDK not available");
  }

  const messagesRef = FirebaseQueryBuilder.doc(COLLECTIONS.CHATS, chatId)
    .collection(SUBCOLLECTIONS.MESSAGES)
    .where('threadId', '==', threadId)
    .orderBy('timestamp', 'asc');

  try {
    let query = messagesRef.limit(limit);
    
    if (lastVisible) {
      query = query.startAfter(lastVisible);
    }

    const snapshot = await query.get();
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ChatMessage[];

    return {
      messages,
      lastVisible: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
    };
  } catch (error) {
    console.error(`[getThreadMessages] Error fetching thread ${threadId} in chat ${chatId}:`, error);
    throw error;
  }
};

/**
 * Gets the root message of a thread
 * @param chatId The ID of the chat containing the thread
 * @param threadId The ID of the thread (messageId of the root message)
 */
export const getThreadRoot = async (
  chatId: string,
  threadId: string
): Promise<ChatMessage | null> => {
  if (!firestoreAdmin) {
    console.error("[getThreadRoot] Firestore Admin SDK is not initialized.");
    throw new Error("Firestore Admin SDK not available");
  }

  try {
    const doc = await FirebaseQueryBuilder.doc(COLLECTIONS.CHATS, chatId)
      .collection(SUBCOLLECTIONS.MESSAGES)
      .doc(threadId)
      .get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() } as ChatMessage;
  } catch (error) {
    console.error(`[getThreadRoot] Error fetching thread root ${threadId} in chat ${chatId}:`, error);
    throw error;
  }
};

/**
 * Gets recent threads for a chat with pagination
 * @param chatId The ID of the chat
 * @param limit Maximum number of threads to return (default: 20)
 * @param lastVisible Last visible document for pagination
 */
export const getRecentThreads = async (
  chatId: string,
  limit: number = 20,
  lastVisible?: FirebaseFirestore.DocumentSnapshot
): Promise<{ threads: ChatMessage[]; lastVisible: FirebaseFirestore.DocumentSnapshot | null }> => {
  if (!firestoreAdmin) {
    console.error("[getRecentThreads] Firestore Admin SDK is not initialized.");
    throw new Error("Firestore Admin SDK not available");
  }

  const threadsQuery = FirebaseQueryBuilder.doc(COLLECTIONS.CHATS, chatId)
    .collection(SUBCOLLECTIONS.MESSAGES)
    .where('isThreadRoot', '==', true)
    .orderBy('lastThreadActivity', 'desc')
    .limit(limit);

  try {
    let query = threadsQuery;
    if (lastVisible) {
      query = threadsQuery.startAfter(lastVisible);
    }

    const snapshot = await query.get();
    const threads = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ChatMessage[];

    return {
      threads,
      lastVisible: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
    };
  } catch (error) {
    console.error(`[getRecentThreads] Error fetching recent threads for chat ${chatId}:`, error);
    throw error;
  }
};
