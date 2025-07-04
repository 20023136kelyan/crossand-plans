// src/services/feedService.server.ts
import 'server-only';
import { firestoreAdmin, ensureFirebaseAdminInitialized } from '@/lib/firebaseAdmin';
import type { FeedPost, FeedPostVisibility, UserRoleType, FeedComment } from '@/types/user';
import { Timestamp as AdminTimestamp, FieldValue, type DocumentData, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getFriendUidsAdmin } from '@/services/userService.server'; 
import type { Firestore } from 'firebase-admin/firestore';
import { FirebaseQueryBuilder, COLLECTIONS, SUBCOLLECTIONS } from '@/lib/data/core/QueryBuilder';

// Legacy constants for backward compatibility
const FEED_POSTS_COLLECTION = COLLECTIONS.FEED_POSTS;
const COMMENTS_SUBCOLLECTION = SUBCOLLECTIONS.COMMENTS;

const convertAdminTimestampToISO = (ts: any): string => {
    if (!ts) return new Date(0).toISOString();
    if (ts instanceof AdminTimestamp) return ts.toDate().toISOString();
    if (ts && typeof ts.toDate === 'function') { 
        try { return ts.toDate().toISOString(); } catch(e) { /* ignore */ }
    }
    if (ts instanceof Date) return ts.toISOString();
    if (typeof ts === 'string') {
        try {
            const parsedDate = new Date(ts);
            if (!isNaN(parsedDate.getTime())) return ts; 
        } catch (e) { /* ignore */ }
    }
    console.warn(`[convertAdminTimestampToISO - FeedService.server] Unexpected timestamp type: ${typeof ts}, value: ${JSON.stringify(ts)}. Returning epoch.`);
    return new Date(0).toISOString();
};

const convertTimestampToMillis = (ts: any): number => {
    if (!ts) return 0;
    if (ts instanceof AdminTimestamp) return ts.toDate().getTime();
    if (ts && typeof ts.toDate === 'function') { 
        try { return ts.toDate().getTime(); } catch(e) { /* ignore */ }
    }
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === 'string') {
        try {
            const parsedDate = new Date(ts);
            if (!isNaN(parsedDate.getTime())) return parsedDate.getTime(); 
        } catch (e) { /* ignore */ }
    }
    console.warn(`[convertTimestampToMillis - FeedService.server] Unexpected timestamp type: ${typeof ts}, value: ${JSON.stringify(ts)}. Returning 0.`);
    return 0;
};

const mapDocToFeedPost = (doc: QueryDocumentSnapshot<DocumentData> | import('firebase-admin/firestore').DocumentSnapshot<DocumentData>): FeedPost => {
  if (!firestoreAdmin) {
    console.error("[mapDocToFeedPost] Firestore Admin SDK is not initialized. This is an unexpected state.");
    throw new Error("Server configuration error: Database service not available in mapDocToFeedPost.");
  }
  const data = doc.data()!;
  return {
    id: doc.id,
    userId: data.userId,
    userName: data.userName || 'Macaroom User',
    userAvatarUrl: data.userAvatarUrl || null,
    userRole: data.userRole || null, 
    userIsVerified: data.userIsVerified || false, 
    planId: data.planId,
    planName: data.planName,
    mediaUrl: data.mediaUrl,
    text: data.text,
    visibility: data.visibility || 'public',
    likesCount: data.likesCount || 0,
    likedBy: data.likedBy || [],
    commentsCount: data.commentsCount || 0,
    sharesCount: data.sharesCount || 0,
    createdAt: convertAdminTimestampToISO(data.createdAt),
  } as FeedPost;
};

export const getFeedPostsAdmin = async (
  currentUserId?: string | null,
  limitCount: number = 20,
  forUserId?: string,
  lastPostCreatedAt?: string // New parameter
): Promise<{ posts: FeedPost[]; nextCursor?: string }> => {
  // Ensure Firebase Admin is properly initialized
  if (!ensureFirebaseAdminInitialized() || !firestoreAdmin) {
    console.error("[getFeedPostsAdmin] CRITICAL: Firestore Admin SDK is not initialized.");
    throw new Error("Server configuration error: Database service not available.");
  }
  
  // Additional safety check for firestoreAdmin methods
  try {
    if (typeof firestoreAdmin.collection !== 'function') {
      console.error("[getFeedPostsAdmin] CRITICAL: Firestore Admin instance is invalid - missing collection method.");
      throw new Error("Server configuration error: Database service is not properly initialized.");
    }
  } catch (initError) {
    console.error("[getFeedPostsAdmin] CRITICAL: Error accessing Firestore Admin instance:", initError);
    throw new Error("Server configuration error: Database service initialization failed.");
  }
  console.log(`[getFeedPostsAdmin] Fetching feed. currentViewerId: ${currentUserId || 'public/unauthenticated'}, forUserId: ${forUserId || 'general feed'}, limit: ${limitCount}, lastPostCreatedAt: ${lastPostCreatedAt}`);

  try {
    const postsMap = new Map<string, FeedPost>();
    let mainQueryProcessed = false;
    
    let lastPostFirestoreTimestamp: AdminTimestamp | undefined = undefined;
    if (lastPostCreatedAt) {
      const d = new Date(lastPostCreatedAt);
      if (!isNaN(d.getTime())) {
        lastPostFirestoreTimestamp = AdminTimestamp.fromDate(d);
      } else {
        console.warn(`[getFeedPostsAdmin] Invalid date string provided for lastPostCreatedAt: ${lastPostCreatedAt}`);
      }
    }

    if (forUserId) {
      // Fetch all posts by the target user
      let userPostsQuery = firestoreAdmin
        .collection(FEED_POSTS_COLLECTION)
        .where('userId', '==', forUserId)
        .orderBy('createdAt', 'desc');

      if (lastPostFirestoreTimestamp) {
        userPostsQuery = userPostsQuery.where('createdAt', '<', lastPostFirestoreTimestamp);
      }

      const userPostsSnapshot = await userPostsQuery.limit(limitCount).get();
      userPostsSnapshot.forEach(doc => {
        const post = mapDocToFeedPost(doc);
        // Only include public posts or private posts if the viewer is the owner or a friend
        if (post.visibility === 'public' || 
            (post.visibility === 'private' && currentUserId === forUserId)) {
          postsMap.set(doc.id, post);
        }
      });
      mainQueryProcessed = true;
    } else {
      // General feed: Public posts from everyone
      let publicPostsQuery = firestoreAdmin
        .collection(FEED_POSTS_COLLECTION)
        .where('visibility', '==', 'public' as FeedPostVisibility)
        .orderBy('createdAt', 'desc');
      if (lastPostFirestoreTimestamp) {
        publicPostsQuery = publicPostsQuery.where('createdAt', '<', lastPostFirestoreTimestamp);
      }
      const publicSnapshot = await publicPostsQuery.limit(limitCount).get();
      publicSnapshot.forEach(doc => {
        if (!postsMap.has(doc.id)) postsMap.set(doc.id, mapDocToFeedPost(doc));
      });

      if (currentUserId) {
        // Current user's own private posts
        let userPrivatePostsQuery = firestoreAdmin
          .collection(FEED_POSTS_COLLECTION)
          .where('visibility', '==', 'private' as FeedPostVisibility)
          .where('userId', '==', currentUserId)
          .orderBy('createdAt', 'desc');
        if (lastPostFirestoreTimestamp) {
          userPrivatePostsQuery = userPrivatePostsQuery.where('createdAt', '<', lastPostFirestoreTimestamp);
        }
        const userPrivateSnapshot = await userPrivatePostsQuery.limit(limitCount).get();
        userPrivateSnapshot.forEach(doc => {
          if (!postsMap.has(doc.id)) postsMap.set(doc.id, mapDocToFeedPost(doc));
        });

        // Private posts from friends
        const friendUids = await getFriendUidsAdmin(currentUserId);
        console.log(`[getFeedPostsAdmin] User ${currentUserId} has ${friendUids.length} friends for feed.`);
        if (friendUids.length > 0) {
          const MAX_UIDS_IN_QUERY = 30; 
          for (let i = 0; i < friendUids.length; i += MAX_UIDS_IN_QUERY) {
            const friendUidChunk = friendUids.slice(i, i + MAX_UIDS_IN_QUERY);
            if (friendUidChunk.length > 0) {
              let friendsPrivateQuery = firestoreAdmin
                .collection(FEED_POSTS_COLLECTION)
                .where('visibility', '==', 'private' as FeedPostVisibility)
                .where('userId', 'in', friendUidChunk)
                .orderBy('createdAt', 'desc');
              if (lastPostFirestoreTimestamp) {
                friendsPrivateQuery = friendsPrivateQuery.where('createdAt', '<', lastPostFirestoreTimestamp);
              }
              const friendsPrivateSnapshot = await friendsPrivateQuery.limit(limitCount).get(); // Limit per chunk query
              friendsPrivateSnapshot.forEach(doc => {
                if (!postsMap.has(doc.id)) postsMap.set(doc.id, mapDocToFeedPost(doc));
              });
            }
          }
        }
      }
      mainQueryProcessed = true;
    }
    
    const combinedPosts = Array.from(postsMap.values());
    if(mainQueryProcessed) {
        combinedPosts.sort((a, b) => {
          const timeA = a.createdAt ? convertTimestampToMillis(a.createdAt) : 0;
          const timeB = b.createdAt ? convertTimestampToMillis(b.createdAt) : 0;
          return timeB - timeA;
        });
        
        const limitedPosts = combinedPosts.slice(0, limitCount);
        let nextCursor: string | undefined = undefined;
        if (limitedPosts.length > 0 && limitedPosts.length === limitCount) { 
            const lastFetchedPost = limitedPosts[limitedPosts.length - 1];
            nextCursor = typeof lastFetchedPost.createdAt === 'string' ? lastFetchedPost.createdAt : convertAdminTimestampToISO(lastFetchedPost.createdAt);
        }
        
        console.log(`[getFeedPostsAdmin] Total combined posts before final limit: ${combinedPosts.length}. Returning ${limitedPosts.length} posts. Next cursor: ${nextCursor}`);
        return { posts: limitedPosts, nextCursor };
    } else {
        console.warn("[getFeedPostsAdmin] No main queries were processed. Returning empty array.");
        return { posts: [], nextCursor: undefined };
    }

  } catch (error) {
    console.error(`[getFeedPostsAdmin] Error fetching feed posts (forUserId: ${forUserId}, lastPostCreatedAt: ${lastPostCreatedAt}):`, error);
    throw error;
  }
};

interface AdminFunctionResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  originalError?: string;
}

interface ToggleLikeResult extends AdminFunctionResult {
  updatedPost?: FeedPost;
}

interface AddCommentResult extends AdminFunctionResult {
  comment?: FeedComment;
  updatedPost?: FeedPost;
}

interface IncrementSharesResult extends AdminFunctionResult {
  updatedPost?: FeedPost;
}


export const toggleLikePostAdmin = async (postId: string, userId: string): Promise<ToggleLikeResult> => {
  try {
    const postRef = FirebaseQueryBuilder.doc(COLLECTIONS.FEED_POSTS, postId);
    let finalUpdatedPost: FeedPost | undefined = undefined;
    await firestoreAdmin!.runTransaction(async (transaction) => {
      const postDoc = await transaction.get(postRef);
      if (!postDoc.exists) {
        // This specific error will be caught by the outer catch and handled.
        throw { customError: true, message: "Post not found.", code: "POST_NOT_FOUND_IN_TRANSACTION" };
      }
      const postData = postDoc.data() as Omit<FeedPost, 'id' | 'createdAt'> & { createdAt: FirebaseFirestore.Timestamp };
      const likedByArray = postData.likedBy || [];
      let currentLikesCount = postData.likesCount || 0;
      
      let newLikedBy = [...likedByArray];
      let newLikesCount = currentLikesCount;

      if (likedByArray.includes(userId)) {
        newLikedBy = likedByArray.filter((uid: string) => uid !== userId);
        newLikesCount = Math.max(0, currentLikesCount - 1);
        transaction.update(postRef, {
          likedBy: FieldValue.arrayRemove(userId),
          likesCount: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp() // Added
        });
      } else {
        newLikedBy.push(userId);
        newLikesCount = currentLikesCount + 1;
        transaction.update(postRef, {
          likedBy: FieldValue.arrayUnion(userId),
          likesCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp() // Added
        });
      }
      const mappedPost = mapDocToFeedPost(postDoc);
      finalUpdatedPost = {
        ...mappedPost,
        likesCount: newLikesCount,    
        likedBy: newLikedBy,          
      };
    });

    if (!finalUpdatedPost) {
        // This path should ideally not be hit if transaction succeeds and mappedPost is constructed.
        // However, if it is, it implies an issue with capturing the state post-transaction logic.
        // Re-fetch post to ensure we return the latest state if finalUpdatedPost wasn't populated as expected.
        const postSnapshotAfter = await postRef.get();
        if (postSnapshotAfter.exists) { // Corrected
            finalUpdatedPost = mapDocToFeedPost(postSnapshotAfter);
        } else {
            console.error(`[toggleLikePostAdmin] Post ${postId} disappeared after like transaction.`);
            return { success: false, error: "Post not found after like operation.", errorCode: "POST_NOT_FOUND" };
        }
    } else {
        // Even if finalUpdatedPost was set, its updatedAt might be based on pre-transaction data from mappedPost.
        // Re-fetch to ensure the returned 'updatedPost' includes the server-set 'updatedAt'.
        const postSnapshotAfter = await postRef.get();
        if (postSnapshotAfter.exists) { // Corrected
            finalUpdatedPost = mapDocToFeedPost(postSnapshotAfter);
        } else {
            // This case is less likely if the transaction succeeded and post existed.
            console.error(`[toggleLikePostAdmin] Post ${postId} disappeared after like transaction (re-fetch).`);
            return { success: false, error: "Post not found after like operation (re-fetch).", errorCode: "POST_NOT_FOUND" };
        }
    }
    return { success: true, updatedPost: finalUpdatedPost };

  } catch (error: any) {
    console.error(`[toggleLikePostAdmin] Firestore Error for post ${postId} by user ${userId}:`, error);
    if (error.customError && error.code === "POST_NOT_FOUND_IN_TRANSACTION") {
        return { success: false, error: "Post not found. It may have been deleted.", errorCode: "POST_NOT_FOUND" };
    }
    // Handle specific Firestore error codes
    if (error.code === 'permission-denied') {
        return { 
            success: false, 
            error: "You don't have permission to perform this action.", 
            errorCode: "PERMISSION_DENIED" 
        };
    }
    if (error.code === 'unavailable') {
        return { 
            success: false, 
            error: "Service temporarily unavailable. Please try again.", 
            errorCode: "SERVICE_UNAVAILABLE" 
        };
    }
    if (error.code === 'deadline-exceeded') {
        return { 
            success: false, 
            error: "Request timed out. Please try again.", 
            errorCode: "TIMEOUT" 
        };
    }
    
    return { 
        success: false, 
        error: "Database operation failed. Please try again.", 
        errorCode: "TRANSACTION_FAILED", 
        originalError: error.message || String(error) 
    };
  }
};


export const addCommentToPostAdmin = async (
  postId: string,
  commentData: Omit<FeedComment, 'id' | 'createdAt'>
): Promise<AddCommentResult> => {
  try {
    const postRef = FirebaseQueryBuilder.doc(COLLECTIONS.FEED_POSTS, postId);
    const commentsRef = FirebaseQueryBuilder.subcollection(COLLECTIONS.FEED_POSTS, postId, SUBCOLLECTIONS.COMMENTS);
    const serverTimestamp = FieldValue.serverTimestamp();
    const newCommentRef = commentsRef.doc(); 
    let finalUpdatedPost: FeedPost | undefined = undefined;
    let finalCommentData: FeedComment | undefined = undefined;

    await firestoreAdmin!.runTransaction(async (transaction) => {
      const postDoc = await transaction.get(postRef);
      if (!postDoc.exists) {
        throw { customError: true, message: "Post not found to add comment.", code: "POST_NOT_FOUND_IN_TRANSACTION" };
      }
      const newCommentsCount = (postDoc.data()?.commentsCount || 0) + 1;
      
      // Prepare comment data with server timestamp for transaction
      const fullCommentDataWithTimestamp = { ...commentData, createdAt: serverTimestamp };
      transaction.set(newCommentRef, fullCommentDataWithTimestamp);
      transaction.update(postRef, { commentsCount: FieldValue.increment(1), updatedAt: serverTimestamp });
      
      const mappedPost = mapDocToFeedPost(postDoc);
      finalUpdatedPost = {
        ...mappedPost,
        commentsCount: newCommentsCount,
        // Use a placeholder for updatedAt, as serverTimestamp is not resolved until commit.
        // Actual value will be fetched or assumed from createdCommentDoc if needed.
        // updatedAt is not part of FeedPost interface 
      };
    });
    
    // Fetch the created comment to get its actual data including the server-generated timestamp
    const createdCommentDoc = await newCommentRef.get();
    if (!createdCommentDoc.exists) { // Corrected
        console.error(`[addCommentToPostAdmin] Comment document ${newCommentRef.id} not found after transaction for post ${postId}.`);
        return { success: false, error: "Failed to retrieve comment after creation.", errorCode: "DATA_RETRIEVAL_ERROR" };
    }
    finalCommentData = {
        id: createdCommentDoc.id,
        postId: createdCommentDoc.data()!.postId,
        userId: createdCommentDoc.data()!.userId,
        userName: createdCommentDoc.data()!.userName,
        username: createdCommentDoc.data()!.username || null,
        userAvatarUrl: createdCommentDoc.data()!.userAvatarUrl,
        text: createdCommentDoc.data()!.text,
        createdAt: convertAdminTimestampToISO(createdCommentDoc.data()!.createdAt),
    };
    
    // Ensure finalUpdatedPost is set, potentially re-fetching if necessary (though ideally transaction provides enough)
    if (!finalUpdatedPost) { 
        const postSnapshotAfter = await postRef.get(); // Re-fetch post to get its latest state
        if(postSnapshotAfter.exists) { // Corrected
            finalUpdatedPost = mapDocToFeedPost(postSnapshotAfter);
        } else {
            console.error(`[addCommentToPostAdmin] Post document ${postId} disappeared after comment transaction.`);
            return { success: false, error: "Post not found after comment operation.", errorCode: "POST_NOT_FOUND" };
        }
    } else {
        // If finalUpdatedPost was set in transaction, its updatedAt might be a client estimate.
        // Re-fetch to get the actual server timestamp for updatedAt if critical,
        // or rely on the fact that it was updated. For now, we'll assume the transaction update is sufficient.
        // If a more accurate updatedAt is needed for the returned 'updatedPost', a re-fetch would be best.
        const postSnapshotAfter = await postRef.get(); 
        if(postSnapshotAfter.exists) finalUpdatedPost = mapDocToFeedPost(postSnapshotAfter); // Corrected
    }
    
    return { 
      success: true, 
      comment: finalCommentData,
      updatedPost: finalUpdatedPost
    };
  } catch (error: any) {
    console.error(`[addCommentToPostAdmin] Firestore Error adding comment to post ${postId}:`, error);
    if (error.customError && error.code === "POST_NOT_FOUND_IN_TRANSACTION") {
        return { success: false, error: "Post not found. It may have been deleted.", errorCode: "POST_NOT_FOUND" };
    }
    return { 
        success: false, 
        error: "Database operation failed. Please try again.", 
        errorCode: "TRANSACTION_FAILED", 
        originalError: error.message || String(error) 
    };
  }
};

export const incrementPostSharesAdmin = async (postId: string): Promise<IncrementSharesResult> => {
  const postRef = FirebaseQueryBuilder.doc(COLLECTIONS.FEED_POSTS, postId);

  try {
    let finalUpdatedPost: FeedPost | undefined = undefined;
    await firestoreAdmin!.runTransaction(async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists) {
            throw { customError: true, message: "Post not found to increment shares.", code: "POST_NOT_FOUND_IN_TRANSACTION" };
        }
        const newSharesCount = (postDoc.data()?.sharesCount || 0) + 1;
        transaction.update(postRef, { sharesCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
        
        const mappedPost = mapDocToFeedPost(postDoc);
        finalUpdatedPost = {
            ...mappedPost,
            sharesCount: newSharesCount
            // updatedAt is not part of FeedPost interface 
        };
    });

    if (!finalUpdatedPost) { 
        console.error(`[incrementPostSharesAdmin] Transaction completed but finalUpdatedPost is undefined for post ${postId}`);
        return { success: false, error: "Failed to get updated post data after transaction.", errorCode: "DATA_RETRIEVAL_ERROR" };
    } else {
        // Re-fetch to ensure 'updatedAt' is from server for the returned post object
        const postSnapshotAfter = await postRef.get();
        if(postSnapshotAfter.exists) { // Corrected
            finalUpdatedPost = mapDocToFeedPost(postSnapshotAfter);
        } else {
             console.error(`[incrementPostSharesAdmin] Post document ${postId} disappeared after share transaction.`);
            return { success: false, error: "Post not found after share operation.", errorCode: "POST_NOT_FOUND" };
        }
    }
    return { success: true, updatedPost: finalUpdatedPost };

  } catch (error: any) {
    console.error(`[incrementPostSharesAdmin] Firestore Error incrementing shares for post ${postId}:`, error);
     if (error.customError && error.code === "POST_NOT_FOUND_IN_TRANSACTION") {
        return { success: false, error: "Post not found. It may have been deleted.", errorCode: "POST_NOT_FOUND" };
    }
    return { 
        success: false, 
        error: "Database operation failed. Please try again.", 
        errorCode: "TRANSACTION_FAILED", 
        originalError: error.message || String(error) 
    };
  }
};

export const deleteFeedPostAdmin = async (postId: string, requestingUserId: string): Promise<{ success: boolean; error?: string }> => {
  const postRef = FirebaseQueryBuilder.doc(COLLECTIONS.FEED_POSTS, postId);
  try {
    const postDoc = await postRef.get();
    if (!postDoc.exists) { // Corrected
      console.warn(`[deleteFeedPostAdmin] Post ${postId} not found. Skipping delete.`);
      return { success: true }; 
    }
    const postData = postDoc.data() as FeedPost; 
    if (postData.userId !== requestingUserId) {
      console.warn(`[deleteFeedPostAdmin] User ${requestingUserId} is not the owner of post ${postId}. Deletion denied by application logic.`);
      throw new Error("User not authorized to delete this post.");
    }
    
    // Delete comments subcollection
    const commentsCollectionRef = postRef.collection(COMMENTS_SUBCOLLECTION);
    const commentsSnapshot = await commentsCollectionRef.limit(500).get(); 
    let batch = firestoreAdmin!.batch();
    let count = 0;
    for (const doc of commentsSnapshot.docs) {
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
    if (commentsSnapshot.docs.length > 0) console.log(`[deleteFeedPostAdmin] Deleted ${commentsSnapshot.docs.length} comments for post ${postId}.`);

    await postRef.delete();
    console.log(`[deleteFeedPostAdmin] Post ${postId} deleted successfully by user ${requestingUserId}.`);
    return { success: true };
  } catch (error: any) {
    console.error(`[deleteFeedPostAdmin] Error deleting post ${postId}:`, error);
    throw error;
  }
};

export const deleteCommentFromPostAdmin = async (
  postId: string,
  commentId: string,
  requestingUserId: string
): Promise<{ success: boolean; error?: string; errorCode?: string; originalError?: string }> => {
  try {
    const postRef = FirebaseQueryBuilder.doc(COLLECTIONS.FEED_POSTS, postId);
    const commentRef = FirebaseQueryBuilder.subcollection(COLLECTIONS.FEED_POSTS, postId, SUBCOLLECTIONS.COMMENTS).doc(commentId);
    let finalUpdatedPost: FeedPost | undefined = undefined;

    await firestoreAdmin!.runTransaction(async (transaction) => {
      const [postDoc, commentDoc] = await Promise.all([
        transaction.get(postRef),
        transaction.get(commentRef)
      ]);

      if (!postDoc.exists) {
        throw { customError: true, message: "Post not found.", code: "POST_NOT_FOUND_IN_TRANSACTION" };
      }

      if (!commentDoc.exists) {
        throw { customError: true, message: "Comment not found.", code: "COMMENT_NOT_FOUND_IN_TRANSACTION" };
      }

      const commentData = commentDoc.data();
      if (!commentData || commentData.userId !== requestingUserId) {
        throw { customError: true, message: "User not authorized to delete this comment.", code: "UNAUTHORIZED_COMMENT_DELETE" };
      }

      transaction.delete(commentRef);
      transaction.update(postRef, { 
        commentsCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp()
      });

      const mappedPost = mapDocToFeedPost(postDoc);
      finalUpdatedPost = {
        ...mappedPost,
        commentsCount: Math.max(0, (postDoc.data()?.commentsCount || 1) - 1)
        // updatedAt is not part of FeedPost interface
      };
    });

    return { success: true };
  } catch (error: any) {
    console.error(`[deleteCommentFromPostAdmin] Error deleting comment ${commentId} from post ${postId}:`, error);
    if (error.customError) {
      switch (error.code) {
        case "POST_NOT_FOUND_IN_TRANSACTION":
          return { success: false, error: "Post not found.", errorCode: "POST_NOT_FOUND" };
        case "COMMENT_NOT_FOUND_IN_TRANSACTION":
          return { success: false, error: "Comment not found.", errorCode: "COMMENT_NOT_FOUND" };
        case "UNAUTHORIZED_COMMENT_DELETE":
          return { success: false, error: "You are not authorized to delete this comment.", errorCode: "UNAUTHORIZED" };
      }
    }
    return { 
      success: false, 
      error: "Database operation failed. Please try again.", 
      errorCode: "TRANSACTION_FAILED", 
      originalError: error.message || String(error) 
    };
  }
};

export const updateUserAvatarInFeedAdmin = async (userId: string, newAvatarUrl: string): Promise<void> => {
  try {
    // Execute both queries concurrently
    const [postsSnapshot, allPostsSnapshot] = await Promise.all([
      FirebaseQueryBuilder.getFilteredQuery(COLLECTIONS.FEED_POSTS, [['userId', '==', userId]]).get(),
      FirebaseQueryBuilder.collection(COLLECTIONS.FEED_POSTS).get()
    ]);
    
    const updatePromises: Promise<void>[] = [];
    
    // Update all feed posts by the user
    if (!postsSnapshot.empty) {
      const updatePostsPromise = (async () => {
        if (!firestoreAdmin) {
          throw new Error("Firestore Admin SDK not available");
        }
        const batch = firestoreAdmin!.batch();
        let operationsCount = 0;
        const MAX_BATCH_SIZE = 500;
        let currentBatch = batch;

        for (const doc of postsSnapshot.docs as QueryDocumentSnapshot<DocumentData>[]) {
          currentBatch.update(doc.ref, { userAvatarUrl: newAvatarUrl });
          operationsCount++;

          if (operationsCount >= MAX_BATCH_SIZE) {
            await currentBatch.commit();
            if (!firestoreAdmin) {
              throw new Error("Firestore Admin SDK not available");
            }
            currentBatch = firestoreAdmin!.batch();
            operationsCount = 0;
          }
        }

        if (operationsCount > 0) {
          await currentBatch.commit();
        }
      })();
      
      updatePromises.push(updatePostsPromise);
    }

    // Update all comments by the user across all posts (concurrent processing)
    const commentUpdatePromises = allPostsSnapshot.docs.map(async (postDoc) => {
      const commentsQuery = postDoc.ref.collection(COMMENTS_SUBCOLLECTION).where('userId', '==', userId);
      const commentsSnapshot = await commentsQuery.get();

      if (!commentsSnapshot.empty) {
        if (!firestoreAdmin) {
          throw new Error("Firestore Admin SDK not available");
        }
        const batch = firestoreAdmin!.batch();
        let operationsCount = 0;
        const MAX_BATCH_SIZE = 500;
        let currentBatch = batch;

        for (const commentDoc of commentsSnapshot.docs as QueryDocumentSnapshot<DocumentData>[]) {
          currentBatch.update(commentDoc.ref, { userAvatarUrl: newAvatarUrl });
          operationsCount++;

          if (operationsCount >= MAX_BATCH_SIZE) {
            await currentBatch.commit();
            if (!firestoreAdmin) {
              throw new Error("Firestore Admin SDK not available");
            }
            currentBatch = firestoreAdmin!.batch();
            operationsCount = 0;
          }
        }

        if (operationsCount > 0) {
          await currentBatch.commit();
        }
      }
    });
    
    updatePromises.push(...commentUpdatePromises);
    
    // Wait for all updates to complete
    await Promise.all(updatePromises);

    console.log(`[updateUserAvatarInFeedAdmin] Successfully updated avatar URL for user ${userId} in all feed posts and comments.`);
  } catch (error) {
    console.error(`[updateUserAvatarInFeedAdmin] Error updating avatar URL for user ${userId}:`, error);
    throw error;
  }
};
