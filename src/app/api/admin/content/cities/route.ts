import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import { createAdminHandler, parseRequestBody } from '@/lib/api/middleware';

// GET /api/admin/content/cities - Get all cities
export const GET = createAdminHandler(
  async ({ request, authResult }) => {
    const citiesSnapshot = await firestoreAdmin!
      .collection('cities')
      .orderBy('name', 'asc')
      .get();

    const cities: any[] = [];
    citiesSnapshot.forEach(doc => {
      const data = doc.data();
      cities.push({
        id: doc.id,
        name: data.name,
        country: data.country,
        state: data.state,
        coordinates: data.coordinates,
        timezone: data.timezone,
        planCount: data.planCount || 0,
        isActive: data.isActive,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      });
    });

    return NextResponse.json({ cities });
  },
  { defaultError: 'Failed to fetch cities' }
);

// POST /api/admin/content/cities - Create new city
export const POST = createAdminHandler(
  async ({ request, authResult }) => {
    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const { name, country, state, coordinates, timezone, isActive } = body;

    if (!name?.trim() || !country?.trim()) {
      return NextResponse.json(
        { error: 'City name and country are required' },
        { status: 400 }
      );
    }

    // Check if city already exists
    const existingCity = await firestoreAdmin!
      .collection('cities')
      .where('name', '==', name.trim())
      .where('country', '==', country.trim())
      .limit(1)
      .get();

    if (!existingCity.empty) {
      return NextResponse.json(
        { error: 'City already exists in this country' },
        { status: 409 }
      );
    }

    const now = new Date();
    const cityData = {
      name: name.trim(),
      country: country.trim(),
      state: state?.trim() || '',
      coordinates: coordinates || { lat: 0, lng: 0 },
      timezone: timezone || 'UTC',
      planCount: 0,
      isActive: isActive !== false,
      createdAt: now,
      updatedAt: now,
      createdBy: authResult.userId
    };

    const docRef = await firestoreAdmin!.collection('cities').add(cityData);

    return NextResponse.json({
      success: true,
      cityId: docRef.id,
      message: 'City created successfully'
    });
  },
  { defaultError: 'Failed to create city' }
);