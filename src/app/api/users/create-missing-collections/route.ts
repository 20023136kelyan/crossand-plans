import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/firebaseAdmin';
import { createDefaultUserCollections } from '@/services/userService.server';

export async function POST(request: NextRequest) {
  try {
    if (!authAdmin) {
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const idToken = authHeader.substring(7);
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Create missing collections for the user
    await createDefaultUserCollections(userId);

    return NextResponse.json({ 
      success: true, 
      message: 'Default collections created successfully' 
    });
  } catch (error: any) {
    console.error('[create-missing-collections] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
} 