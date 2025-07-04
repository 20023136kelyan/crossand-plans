import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import { createAdminHandler, getQueryParams } from '@/lib/api/middleware';

export const GET = createAdminHandler(
  async ({ request, authResult }) => {
    // Get query parameters with validation
    const { params, error } = getQueryParams(request, {
      page: { required: false, defaultValue: '1' },
      limit: { required: false, defaultValue: '50' },
      search: { required: false },
      role: { required: false },
      sortBy: { required: false, defaultValue: 'createdAt' },
      sortOrder: { required: false, defaultValue: 'desc' }
    });
    if (error) return error;

    const page = parseInt(params.page!) || 1;
    const limit = Math.min(parseInt(params.limit!) || 50, 100); // Cap at 100
    const search = params.search;
    const role = params.role;
    const sortBy = params.sortBy!;
    const sortOrder = params.sortOrder! as 'asc' | 'desc';

    let query: any = firestoreAdmin!.collection('users');

    // Apply search filter
    if (search) {
      // Simple search by email or firstName (Firestore limitations)
      query = query.where('email', '>=', search)
                   .where('email', '<=', search + '\uf8ff');
    }

    // Apply role filter
    if (role) {
      query = query.where('role', '==', role);
    }

    // Apply sorting
    query = query.orderBy(sortBy, sortOrder);

    // Apply pagination
    const offset = (page - 1) * limit;
    if (offset > 0) {
      const offsetSnapshot = await query.limit(offset).get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    const usersSnapshot = await query.limit(limit).get();

    const users: any[] = [];
    usersSnapshot.forEach((doc: any) => {
      const data = doc.data();
      users.push({
        id: doc.id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'user',
        isActive: data.isActive !== false,
        emailVerified: data.emailVerified || false,
        createdAt: data.createdAt?.toDate() || new Date(),
        lastLoginAt: data.lastLoginAt?.toDate() || null,
        planCount: data.planCount || 0,
        followerCount: data.followerCount || 0,
        followingCount: data.followingCount || 0
      });
    });

    // Get total count for pagination (this is expensive in Firestore)
    const totalSnapshot = await firestoreAdmin!.collection('users').get();
    const totalUsers = totalSnapshot.size;
    const totalPages = Math.ceil(totalUsers / limit);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  },
  { defaultError: 'Failed to fetch users' }
);