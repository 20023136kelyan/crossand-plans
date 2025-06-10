import { NextResponse } from 'next/server';
import { authAdmin as auth, firestoreAdmin as db } from '@/lib/firebaseAdmin';

export async function HEAD(request: Request) {
  if (!auth || !db) {
    return new NextResponse(null, { status: 503 }); // Service Unavailable
  }

  try {
    // Verify admin authorization for health check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new NextResponse(null, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);

    // Check if the user has admin custom claims
    if (!decodedToken.admin) {
      return new NextResponse(null, { status: 403 });
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return new NextResponse(null, { status: 401 });
  }
}

export async function GET(request: Request) {
  if (!auth || !db) {
    console.error('Firebase Admin services not initialized');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    // Verify admin authorization
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);

    // Check if the user has admin custom claims
    if (!decodedToken.admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get URL parameters for pagination
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search') || '';
    const role = url.searchParams.get('role') || '';

    // List users from Firebase Auth
    const listUsersResult = await auth.listUsers(limit);
    let users = listUsersResult.users;

    // Get additional user data from Firestore
    const userIds = users.map(user => user.uid);
    const userProfiles: { [key: string]: any } = {};

    if (userIds.length > 0) {
      // Batch get user profiles from Firestore
      const chunks = [];
      for (let i = 0; i < userIds.length; i += 10) {
        chunks.push(userIds.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        const docs = await Promise.all(
          chunk.map(uid => db.collection('users').doc(uid).get())
        );
        
        docs.forEach(doc => {
          if (doc.exists) {
            userProfiles[doc.id] = doc.data();
          }
        });
      }
    }

    // Format user data
    const formattedUsers = users.map(user => {
      const profile = userProfiles[user.uid] || {};
      return {
        id: user.uid,
        email: user.email || '',
        displayName: user.displayName || profile.displayName || '',
        role: profile.role || 'user',
        isVerified: profile.isVerified || false,
        createdAt: user.metadata.creationTime,
        lastLoginAt: user.metadata.lastSignInTime,
        disabled: user.disabled,
        customClaims: user.customClaims || {},
        photoURL: user.photoURL || profile.photoURL || '',
        phoneNumber: user.phoneNumber || '',
        emailVerified: user.emailVerified
      };
    });

    // Apply filters
    let filteredUsers = formattedUsers;

    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = filteredUsers.filter(user => 
        user.email.toLowerCase().includes(searchLower) ||
        user.displayName.toLowerCase().includes(searchLower)
      );
    }

    if (role && role !== 'all') {
      filteredUsers = filteredUsers.filter(user => user.role === role);
    }

    // Sort by creation date (newest first)
    filteredUsers.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      users: paginatedUsers,
      pagination: {
        page,
        limit,
        total: filteredUsers.length,
        totalPages: Math.ceil(filteredUsers.length / limit)
      }
    });

  } catch (error) {
    console.error('Error listing users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}