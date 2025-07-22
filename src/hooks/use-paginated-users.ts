import { useEffect, useState, useCallback } from 'react';
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile } from '@/types/user';
import type { Firestore } from 'firebase/firestore';

interface UsePaginatedUsersOptions {
  userType: 'followers' | 'following' | 'friends';
  userId: string;
  searchTerm?: string;
  sortAsc?: boolean;
  pageSize?: number;
}

type OrderDirection = 'asc' | 'desc';

export function usePaginatedUsers({ userType, userId, searchTerm = '', sortAsc = true, pageSize = 20 }: UsePaginatedUsersOptions) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [resetKey, setResetKey] = useState(0); // for resetting on search/sort change

  // Reset when searchTerm, sortAsc, or userId changes
  useEffect(() => {
    setUsers([]);
    setPage(0);
    setHasMore(true);
    setResetKey(k => k + 1);
  }, [searchTerm, sortAsc, userId, userType]);

  const fetchNextPage = useCallback(async () => {
    if (loading || !hasMore || !userId) return;
    if (!db) {
      setHasMore(false);
      setLoading(false);
      return;
    }
    const dbInstance = db as Firestore;
    setLoading(true);
    try {
      // 1. Fetch the current user's document to get the array of IDs
      const userDocRef = doc(dbInstance, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        setHasMore(false);
        setLoading(false);
        return;
      }
      const userData = userDocSnap.data();
      let idArray: string[] = [];
      if (userType === 'followers') idArray = userData.followers || [];
      if (userType === 'following') idArray = userData.following || [];
      if (userType === 'friends') {
        const followers: string[] = userData.followers || [];
        const following: string[] = userData.following || [];
        idArray = following.filter(id => followers.includes(id));
      }
      // 2. Search (filter by name/username if searchTerm)
      // We'll fetch all profiles for the current page, then filter client-side (for now)
      // 3. Paginate the array of IDs
      const start = page * pageSize;
      const nextIds = idArray.slice(start, start + pageSize);
      if (nextIds.length === 0) {
        setHasMore(false);
        setLoading(false);
        return;
      }
      // 4. Batch fetch user profiles from main users collection
      const userProfilePromises = nextIds.map(id => getDoc(doc(dbInstance, 'users', id)));
      const userProfileSnaps = await Promise.all(userProfilePromises);
      let newUsers = userProfileSnaps
        .filter(snap => snap.exists())
        .map(snap => ({ uid: snap.id, ...snap.data() } as UserProfile));
      // 5. Search (filter by name/username if searchTerm)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        newUsers = newUsers.filter(u =>
          (u.name?.toLowerCase() || '').includes(searchLower) ||
          (u.username?.toLowerCase() || '').includes(searchLower)
        );
      }
      // 6. Sort
      newUsers.sort((a, b) => {
        const aName = (a.name || a.username || '').toLowerCase();
        const bName = (b.name || b.username || '').toLowerCase();
        if (aName < bName) return sortAsc ? -1 : 1;
        if (aName > bName) return sortAsc ? 1 : -1;
        return 0;
      });
      setUsers(prev => [...prev, ...newUsers]);
      setPage(prev => prev + 1);
      setHasMore(start + pageSize < idArray.length);
    } catch (err) {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line
  }, [userType, userId, searchTerm, sortAsc, pageSize, page, loading, hasMore, resetKey]);

  return { users, loading, hasMore, fetchNextPage };
} 