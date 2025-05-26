// src/services/chatService.ts (Client SDK functions)
import { db, ClientTimestamp } from '@/lib/firebase'; // Ensure this is the CLIENT SDK db
import type { Chat, ChatMessage, ChatType } from '@/types/user';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  doc,
  onSnapshot,
  type DocumentData,
  getDoc,
  getDocs, // Added getDocs for one-time fetch
  type Unsubscribe,
  // type QuerySnapshot, // Explicit type alias removed, direct import used below
} from 'firebase/firestore';
import { parseISO, isValid } from 'date-fns';
import { debounce } from 'lodash';

const CHATS_COLLECTION = 'chats';
const MESSAGES_SUBCOLLECTION = 'messages';

const convertClientChatTimestamps = (data: any): Pick<Chat, 'createdAt' | 'updatedAt' | 'lastMessageTimestamp' | 'participantReadTimestamps'> => {
  const convertSingleTimestamp = (ts: any): string => {
    if (!ts) return new Date(0).toISOString();
    if (ts instanceof ClientTimestamp) return ts.toDate().toISOString();
    if (ts instanceof Date) return ts.toISOString();
    if (ts && typeof ts.toDate === 'function') {
        try { return ts.toDate().toISOString(); } catch (e) { /* ignore */ }
    }
    if (typeof ts === 'string') {
        try {
            const parsed = parseISO(ts);
            if (isValid(parsed)) return ts;
        } catch (e) { /* ignore */ }
    }
    console.warn(`[convertClientChatTimestamps] Unexpected chat timestamp type: ${typeof ts}. Value: ${JSON.stringify(ts)}. Returning epoch.`);
    return new Date(0).toISOString();
  };
  
  const convertOptionalTimestamp = (ts: any): string | null => {
    if (!ts) return null;
    if (ts instanceof ClientTimestamp) return ts.toDate().toISOString();
    if (ts instanceof Date) return ts.toISOString();
    if (ts && typeof ts.toDate === 'function') {
        try { return ts.toDate().toISOString(); } catch (e) { return null; }
    }
    if (typeof ts === 'string') {
        try {
            const parsed = parseISO(ts);
            if (isValid(parsed)) return ts;
        } catch (e) { /* ignore */ }
    }
    return null;
  };
  
  let processedReadTimestamps: { [userId: string]: string } = {};
  if (data.participantReadTimestamps && typeof data.participantReadTimestamps === 'object') {
    Object.entries(data.participantReadTimestamps).forEach(([key, value]) => {
      const convertedTs = convertOptionalTimestamp(value as any); 
      if (convertedTs) {
        processedReadTimestamps[key] = convertedTs;
      }
    });
  }

  return {
    createdAt: convertSingleTimestamp(data.createdAt),
    updatedAt: convertSingleTimestamp(data.updatedAt),
    lastMessageTimestamp: convertOptionalTimestamp(data.lastMessageTimestamp),
    participantReadTimestamps: processedReadTimestamps,
  };
};

const mapDocToChat = (docSnap: import('firebase/firestore').DocumentSnapshot<DocumentData>): Chat => {
    const data = docSnap.data()!;
    const timestamps = convertClientChatTimestamps(data);
    return {
        id: docSnap.id,
        participants: data.participants || [],
        participantInfo: data.participantInfo || [],
        type: data.type || 'direct',
        lastMessageText: data.lastMessageText || '',
        lastMessageSenderId: data.lastMessageSenderId || '',
        groupName: data.groupName || null,
        groupAvatarUrl: data.groupAvatarUrl || null,
        ...timestamps,
    } as Chat;
};

export const getChatDetails = async (chatId: string): Promise<Chat | null> => {
  if (!db) {
    console.warn("[chatService.ts client] Firestore (db) is not initialized for getChatDetails.");
    return null;
  }
  if (!chatId) {
    console.warn("[chatService.ts client] getChatDetails called with no chatId.");
    return null;
  }
  try {
    const chatDocRef = doc(db, CHATS_COLLECTION, chatId);
    const chatDocSnap = await getDoc(chatDocRef);
    if (chatDocSnap.exists()) {
      return mapDocToChat(chatDocSnap);
    }
    // console.log(`[chatService.ts client] Chat not found: ${chatId}`);
    return null;
  } catch (error) {
    console.error(`[chatService.ts client] Error fetching chat details ${chatId}:`, error);
    return null;
  }
};

export const getChatMessages = (
  chatId: string,
  onMessagesUpdate: (messages: ChatMessage[]) => void
): Unsubscribe => { 
  if (!db) {
    console.warn("[chatService.ts client] Firestore (db) not initialized for getChatMessages.");
    return () => {}; 
  }
  if (!chatId) {
    console.warn("[chatService.ts client] getChatMessages called with no chatId.");
    onMessagesUpdate([]);
    return () => {};
  }

  // Create a debounced version of onMessagesUpdate
  const debouncedUpdate = debounce(onMessagesUpdate, 100);
  
  const messagesRef = collection(db, CHATS_COLLECTION, chatId, MESSAGES_SUBCOLLECTION);
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const messages: ChatMessage[] = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      let timestampStr = new Date(0).toISOString(); 
      
      // Simplified timestamp handling
      const ts = data.timestamp;
      if (ts) {
        if (ts instanceof ClientTimestamp || (ts && typeof ts.toDate === 'function')) {
          timestampStr = ts.toDate().toISOString();
        } else if (ts instanceof Date) {
          timestampStr = ts.toISOString();
        } else if (typeof ts === 'string' && isValid(parseISO(ts))) {
          timestampStr = ts;
        }
      }

      return { 
        id: docSnap.id, 
        senderId: data.senderId,
        text: data.text || undefined,
        mediaUrl: data.mediaUrl || undefined,
        mediaContentType: data.mediaContentType || undefined,
        timestamp: timestampStr,
        hiddenBy: Array.isArray(data.hiddenBy) ? data.hiddenBy : [],
      } as ChatMessage;
    });

    debouncedUpdate(messages);
  }, (error) => {
    console.error(`[chatService.ts client] Error fetching messages for chat ${chatId}:`, error);
    debouncedUpdate([]);
  });

  return () => {
    debouncedUpdate.cancel();
    unsubscribe();
  };
};

export const getUserChats = (
  userId: string,
  onChatsUpdate: (chats: Chat[]) => void
): Unsubscribe => {
  if (!db) {
    console.warn("[chatService.ts client] Firestore (db) is not initialized for getUserChats.");
    onChatsUpdate([]);
    return () => {};
  }
  if (!userId) {
    console.warn("[chatService.ts client] getUserChats called with no userId.");
    onChatsUpdate([]);
    return () => {};
  }
  // console.log(`[chatService.ts client] Subscribing to chats for user: ${userId}`);

  const chatsRef = collection(db, CHATS_COLLECTION);
  const q = query(
    chatsRef,
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc')
  );

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const userChats: Chat[] = [];
    querySnapshot.forEach((docSnap) => {
      userChats.push(mapDocToChat(docSnap));
    });
    // console.log(`[chatService.ts client] Fetched ${userChats.length} chats for user ${userId}`);
    onChatsUpdate(userChats);
  }, (error) => {
    console.error(`[chatService.ts client] Error fetching user chats in real-time for ${userId}: `, error);
    onChatsUpdate([]);
  });

  return unsubscribe;
};

// This function is for client-side check before calling server action to create chat.
// It's okay for it to use client SDK and be subject to rules.
export const getExistingDirectChatIdClient = async (currentUserUid: string, friendUid: string): Promise<string | null> => {
  if (!db) {
    console.warn("[getExistingDirectChatIdClient] Firestore client SDK not initialized.");
    return null;
  }
  if (!currentUserUid || !friendUid) {
    console.warn("[getExistingDirectChatIdClient] Missing user UIDs.");
    return null;
  }
  const participantsArray = [currentUserUid, friendUid].sort();
  const chatsRef = collection(db, CHATS_COLLECTION);
  const q = query(
    chatsRef,
    where('type', '==', 'direct' as ChatType),
    where('participants', '==', participantsArray),
    limit(1)
  );
  try {
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].id;
    }
    return null;
  } catch (error) {
    console.error("[getExistingDirectChatIdClient] Error checking for existing direct chat:", error);
    throw error; 
  }
};
