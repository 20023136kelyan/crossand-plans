
// src/services/feedService.ts (Client SDK functions)
import { db, ClientTimestamp } from '@/lib/firebase';
import type { FeedComment } from '@/types/user';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  type Unsubscribe,
  type DocumentData,
  type DocumentSnapshot, // Added for mapDocToFeedComment
} from 'firebase/firestore';
import { parseISO, isValid } from 'date-fns';

const FEED_POSTS_COLLECTION = 'feedPosts';
const COMMENTS_SUBCOLLECTION = 'comments';

const convertClientFeedCommentTimestampToISO = (ts: any, fieldName: string = 'timestamp'): string => {
    if (!ts) {
      // console.warn(`[convertClientFeedCommentTimestampToISO] Received null or undefined for ${fieldName}, returning epoch.`);
      return new Date(0).toISOString();
    }
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
    console.warn(`[feedService.ts client] convertClientFeedCommentTimestampToISO: Unexpected ${fieldName} type: ${typeof ts}. Value: ${JSON.stringify(ts)}. Returning epoch.`);
    return new Date(0).toISOString();
};

const mapDocToFeedComment = (docSnap: DocumentSnapshot<DocumentData>, postIdForContext: string): FeedComment => {
  const data = docSnap.data();
  if (!data) {
    // This case should ideally not happen if docSnap.exists() is true
    console.error(`[mapDocToFeedComment] No data found for comment doc ${docSnap.id} in post ${postIdForContext}`);
    return {
      id: docSnap.id,
      postId: postIdForContext,
      userId: 'unknown',
      userName: 'Unknown User',
      userAvatarUrl: null,
      text: 'Error loading comment data.',
      createdAt: new Date(0).toISOString(),
    } as FeedComment;
  }
  return {
    id: docSnap.id,
    postId: data.postId || postIdForContext, // Fallback to context if missing
    userId: data.userId,
    userName: data.userName,
    userAvatarUrl: data.userAvatarUrl,
    text: data.text,
    createdAt: convertClientFeedCommentTimestampToISO(data.createdAt, `comment ${docSnap.id} createdAt`),
  } as FeedComment;
};


export const getPostComments = (
  postId: string,
  onUpdate: (comments: FeedComment[]) => void,
  onErrorCallback?: (error: Error) => void
): Unsubscribe => {
  if (!db) {
    console.warn("[feedService.ts client] Firestore (db) is not initialized for getPostComments.");
    if (onErrorCallback) onErrorCallback(new Error("Firestore not initialized."));
    onUpdate([]); 
    return () => {};
  }
  if (!postId) {
    console.warn("[feedService.ts client] getPostComments called with no postId.");
    if (onErrorCallback) onErrorCallback(new Error("Post ID not provided."));
    onUpdate([]);
    return () => {};
  }
  console.log(`[feedService.ts client] Subscribing to comments for post: ${postId}`);
  const commentsRef = collection(db, FEED_POSTS_COLLECTION, postId, COMMENTS_SUBCOLLECTION);
  const q = query(commentsRef, orderBy('createdAt', 'asc')); 

  const unsubscribe = onSnapshot(q, (snapshot) => {
    console.log(`[feedService.ts client] Comments snapshot received for post ${postId}. Docs count: ${snapshot.docs.length}`);
    const comments = snapshot.docs.map(docSnap => mapDocToFeedComment(docSnap, postId));
    // console.log(`[feedService.ts client] Mapped ${comments.length} comments for post ${postId}. First comment (if any):`, comments[0]);
    onUpdate(comments);
  }, (error) => {
    console.error(`[feedService.ts client] Error fetching comments for post ${postId}:`, error);
    if (onErrorCallback) onErrorCallback(error);
    onUpdate([]); 
  });
  return unsubscribe;
};
