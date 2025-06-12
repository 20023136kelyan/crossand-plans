import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/lib/firebaseAdmin';
import { City } from '@/types/user';

// GET /api/admin/content/cities - Get all featured cities
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin!.verifyIdToken(token);
    
    if (!decodedToken.admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const citiesSnapshot = await firestoreAdmin!
      .collection('featuredCities')
      .orderBy('date', 'desc')
      .get();

    const cities: City[] = [];
    citiesSnapshot.forEach(doc => {
      const data = doc.data();
      cities.push({
        id: doc.id,
        name: data.name,
        location: data.location,
        date: data.date,
        imageUrl: data.imageUrl
      });
    });

    return NextResponse.json({ cities });
  } catch (error) {
    console.error('Error fetching cities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cities' },
      { status: 500 }
    );
  }
}

// POST /api/admin/content/cities - Add new featured city
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin!.verifyIdToken(token);
    
    if (!decodedToken.admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { name, location, date, imageUrl } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'City name is required' },
        { status: 400 }
      );
    }

    if (!location?.trim()) {
      return NextResponse.json(
        { error: 'Location is required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const cityData = {
      name: name.trim(),
      location: location.trim(),
      date: date || now.toISOString().split('T')[0], // Default to today if no date provided
      imageUrl: imageUrl?.trim() || '',
      createdAt: now,
      updatedAt: now,
      createdBy: decodedToken.uid
    };

    const docRef = await firestoreAdmin!.collection('featuredCities').add(cityData);

    return NextResponse.json({
      success: true,
      cityId: docRef.id,
      message: 'Featured city added successfully'
    });
  } catch (error) {
    console.error('Error adding featured city:', error);
    return NextResponse.json(
      { error: 'Failed to add featured city' },
      { status: 500 }
    );
  }
}