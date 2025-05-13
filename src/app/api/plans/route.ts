import { NextResponse } from 'next/server';
import { z } from 'zod';
import { planSchema } from '@/lib/schemas';
import { MOCK_USER_ID } from '@/types';
import { storePlan, getAllPlans, getPlan, ensureRequiredItineraryFields } from '@/lib/storage/plans';
import type { Plan, ItineraryItem, PlanStatus } from '@/types';
import { isValid, parseISO } from 'date-fns';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log('Received plan creation request with data:', JSON.stringify(data, null, 2));
    
    // Ensure required fields exist with defaults
    if (!data.hostId) {
      console.warn("hostId missing in request, adding default MOCK_USER_ID");
      data.hostId = MOCK_USER_ID;
    }

    if (!data.itinerary || !Array.isArray(data.itinerary) || data.itinerary.length === 0) {
      console.warn("itinerary missing or empty in request, creating a default item");
      if (data.location && data.city) {
        const now = new Date().toISOString();
        data.itinerary = [{
          id: `default_itin_${Date.now()}`,
          placeName: data.location,
          address: data.location,
          city: data.city,
          description: `Visit ${data.location}`,
          startTime: data.eventTime || now,
          endTime: null,
          activitySuggestions: []
        }];
      }
    }
    
    // Process itinerary items to ensure they have required fields
    const processedItinerary: ItineraryItem[] = (data.itinerary || []).map((item: any) => 
      ensureRequiredItineraryFields({
        id: item.id,
        placeName: item.placeName || '',
        address: item.address || item.placeName || '',
        city: item.city || data.city || '',
        description: item.description || `Visit ${item.placeName || data.location || ''}`,
        startTime: item.startTime || data.eventTime || new Date().toISOString(),
        endTime: item.endTime || null,
        googleMapsImageUrl: item.googleMapsImageUrl || null,
        rating: item.rating || null,
        reviewCount: item.reviewCount || null,
        activitySuggestions: item.activitySuggestions || [],
      })
    );

    // Generate a unique ID
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    // Prepare plan data for validation
    const planDataForValidation = {
      id: planId,
      hostId: data.hostId || MOCK_USER_ID,
      name: data.name || 'Untitled Plan',
      description: data.description || `Plan created on ${new Date().toLocaleDateString()}`,
      eventTime: data.eventTime || now,
      location: data.location || processedItinerary[0]?.placeName || 'Unknown Location',
      city: data.city || processedItinerary[0]?.city || 'Unknown City',
      eventType: data.eventType || 'Casual Meeting',
      priceRange: data.priceRange || 'Budget (0-15 USD)',
      status: (data.status || 'draft') as PlanStatus,
      createdAt: now,
      updatedAt: now,
      planType: data.planType || 'single-stop',
      invitedParticipantUserIds: data.invitedParticipantUserIds || [],
      selectedPoint: data.selectedPoint || null,
      mapRadiusKm: data.mapRadiusKm || 5,
      userEnteredCityForStep2: data.userEnteredCityForStep2 || '',
      itinerary: processedItinerary,
    };
    
    console.log('Attempting to validate plan data:', JSON.stringify(planDataForValidation, null, 2));

    // Validate the data
    try {
      const validatedData = planSchema.parse(planDataForValidation);
      console.log('Validation successful:', JSON.stringify(validatedData, null, 2));
      
      // Store the plan using the shared storage
      const planToStore: Plan = {
        id: planId,
        hostId: validatedData.hostId,
        name: validatedData.name,
        description: validatedData.description,
        eventTime: validatedData.eventTime,
        location: validatedData.location,
        city: validatedData.city,
        eventType: validatedData.eventType || '',
        priceRange: validatedData.priceRange,
        status: validatedData.status as PlanStatus,
        createdAt: now,
        updatedAt: now,
        planType: validatedData.planType || 'single-stop',
        invitedParticipantUserIds: validatedData.invitedParticipantUserIds || [],
        selectedPoint: validatedData.selectedPoint || null,
        mapRadiusKm: validatedData.mapRadiusKm || null,
        userEnteredCityForStep2: validatedData.userEnteredCityForStep2 || null,
        itinerary: validatedData.itinerary.map(item => ensureRequiredItineraryFields(item)),
      };
      
      const storedPlan = storePlan(planId, planToStore);
      console.log('Plan stored successfully:', JSON.stringify(storedPlan, null, 2));

      return NextResponse.json(storedPlan, { status: 201 });
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const errorDetails = validationError.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        console.error('Validation errors:', JSON.stringify(errorDetails, null, 2));
        
        // Try a fallback approach - create a minimal valid plan
        try {
          console.log('Attempting fallback plan creation with minimal fields');
          
          const minimalPlan: Plan = {
            id: planId,
            hostId: MOCK_USER_ID,
            name: data.name || 'Untitled Plan',
            description: data.description || 'Plan created via fallback method',
            eventTime: now,
            location: data.location || 'Unknown Location',
            city: data.city || 'Unknown City',
            priceRange: 'Budget (0-15 USD)',
            status: 'draft',
            createdAt: now,
            updatedAt: now,
            planType: 'single-stop',
            invitedParticipantUserIds: [],
            itinerary: [{
              id: `fallback_itin_${Date.now()}`,
              placeName: data.location || 'Unknown Location',
              address: data.location || 'Unknown Address',
              city: data.city || 'Unknown City',
              description: data.description || 'Fallback itinerary item',
              startTime: now,
              endTime: null,
              activitySuggestions: []
            }]
          };
          
          const storedFallbackPlan = storePlan(planId, minimalPlan);
          console.log('Fallback plan stored successfully');
          return NextResponse.json(storedFallbackPlan, { status: 201 });
        } catch (fallbackError) {
          console.error('Even fallback plan creation failed:', fallbackError);
          return NextResponse.json(
            { message: 'Validation failed', errors: errorDetails },
            { status: 400 }
          );
        }
      }
      
      throw validationError; // Re-throw if not a ZodError
    }
  } catch (error) {
    console.error('Error creating plan:', error);
    if (error instanceof z.ZodError) {
      const errorDetails = error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code
      }));
      console.error('Validation errors:', JSON.stringify(errorDetails, null, 2));
      return NextResponse.json(
        { message: 'Validation failed', errors: errorDetails },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to create plan' },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    
    if (!data.id) {
      return NextResponse.json({ message: 'Plan ID is required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    
    // Validate the incoming data
    const validatedData = planSchema.parse({
      ...data,
      createdAt: data.createdAt || now,
      updatedAt: now,
      itinerary: (data.itinerary || []).map((item: any) => ensureRequiredItineraryFields(item)),
    });

    // Update the plan using shared storage
    const updatedPlan: Plan = {
      ...validatedData,
      id: data.id,
      createdAt: validatedData.createdAt || now,
      updatedAt: now,
      itinerary: validatedData.itinerary.map(item => ensureRequiredItineraryFields(item)),
    };
    
    const storedPlan = storePlan(data.id, updatedPlan);

    return NextResponse.json(storedPlan);
  } catch (error) {
    console.error('Error updating plan:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to update plan' },
      { status: 400 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const plan = getPlan(id);
    if (!plan) {
      return NextResponse.json({ message: 'Plan not found' }, { status: 404 });
    }
    return NextResponse.json(plan);
  }

  return NextResponse.json(getAllPlans());
} 