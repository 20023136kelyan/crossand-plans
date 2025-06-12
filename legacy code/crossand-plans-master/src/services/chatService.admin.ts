// src/services/chatService.admin.ts
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { Chat, ChatParticipantInfo, ChatType } from '@/types/user';
import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';

const CHATS_COLLECTION = 'chats';

interface ProcessedBasicUserInfo {
  uid: string;
  name: string; 
  avatarUrl: string | null;
}

export const createDirectChatAdmin = async (
  currentUser: ProcessedBasicUserInfo,
  friend: ProcessedBasicUserInfo
): Promise<string> => {
  if (!firestoreAdmin) {
    console.error("Firestore Admin SDK is not initialized for createDirectChatAdmin.");
    throw new Error("Firestore Admin SDK not available");
  }

  const participantsArray = [currentUser.uid, friend.uid].sort();
  const now = FieldValue.serverTimestamp() as AdminTimestamp;

  const participantInfo: ChatParticipantInfo[] = [
    { uid: currentUser.uid, name: currentUser.name, avatarUrl: currentUser.avatarUrl },
    { uid: friend.uid, name: friend.name, avatarUrl: friend.avatarUrl },
  ];
  
  const initialReadTimestamps: { [userId: string]: AdminTimestamp } = {};
  // Sender effectively "reads" the chat upon creation/first message if we were to send one.
  // For now, initializing empty or with sender's timestamp if a message was part of creation.
  // Since no message is sent on creation, empty is fine.
  // Or, set both to a very old timestamp if needed for some logic:
  // initialReadTimestamps[currentUser.uid] = AdminTimestamp.fromDate(new Date(0));
  // initialReadTimestamps[friend.uid] = AdminTimestamp.fromDate(new Date(0));


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
      participantReadTimestamps: initialReadTimestamps, // Initialize empty
    });
    console.log('Direct chat created successfully with ID (Admin SDK):', newChatDocRef.id);
    return newChatDocRef.id;
  } catch (error) {
    console.error('Error creating direct chat (Admin SDK):', error);
    throw error;
  }
};

export const getExistingDirectChatIdAdmin = async (
  currentUserUid: string,
  friendUid: string
): Promise<string | null> => {
  if (!firestoreAdmin) {
    console.error("Firestore Admin SDK is not initialized for getExistingDirectChatIdAdmin.");
    throw new Error("Firestore Admin SDK not available");
  }

  const participantsArray = [currentUserUid, friendUid].sort();

  const chatsRef = firestoreAdmin.collection(CHATS_COLLECTION);
  const q = chatsRef
    .where('type', '==', 'direct' as ChatType)
    .where('participants', '==', participantsArray)
    .limit(1);

  try {
    const querySnapshot = await q.get();
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].id;
    }
    return null; // No existing chat found
  } catch (error) {
    console.error('Error in getExistingDirectChatIdAdmin (Admin SDK):', error);
    throw error;
  }
};
