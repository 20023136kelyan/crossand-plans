import { NextRequest, NextResponse } from 'next/server';
import { storageAdmin } from '@/lib/firebaseAdmin';

export async function GET() {
  try {
    if (!storageAdmin) {
      return NextResponse.json(
        { 
          status: 'error', 
          service: 'storage',
          message: 'Storage Admin not initialized',
          timestamp: new Date().toISOString()
        },
        { status: 503 }
      );
    }
    
    const storage = storageAdmin;
    
    // Test storage connectivity by checking if we can access the bucket
    const bucket = storage.bucket();
    await bucket.getMetadata();
    
    return NextResponse.json({ 
      status: 'ok', 
      service: 'storage',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Storage health check failed:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        service: 'storage',
        message: 'Storage service unavailable' 
      },
      { status: 500 }
    );
  }
}

export async function HEAD() {
  try {
    if (!storageAdmin) {
      return new NextResponse(null, { status: 503 });
    }
    
    const storage = storageAdmin;
    const bucket = storage.bucket();
    await bucket.getMetadata();
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return new NextResponse(null, { status: 500 });
  }
}