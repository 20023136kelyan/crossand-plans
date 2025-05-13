import { NextResponse } from 'next/server';
import { generateFullPlanDetailsFlow as generateFullPlanDetails } from '@/ai/flows/generate-full-plan-details';

export async function GET() {
  console.log('Testing plan generation...\n');

  const testInput = {
    userPrompt: "Plan a fun afternoon in San Francisco with a museum visit and dinner",
    hostId: "test-host-123",
    participantUserIds: ["user-1", "user-2"],
    participantPreferences: ["Cultural activities", "Fine dining"],
    planType: "multi-stop" as const,
    priceRange: "$$",
    userEnteredCity: "San Francisco",
    userSuggestedEventTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
  };

  try {
    console.log('Input:', JSON.stringify(testInput, null, 2), '\n');
    
    const plan = await generateFullPlanDetails(testInput);
    
    // Verify key aspects of the generated plan
    const verificationResults = {
      basicStructure: {
        name: !!plan.name,
        description: !!plan.description,
        eventType: !!plan.eventType,
        location: !!plan.location,
        city: !!plan.city,
        eventTime: !!plan.eventTime
      },
      itineraryItems: plan.itinerary?.map(item => ({
        placeName: !!item.placeName,
        description: !!item.description,
        duration: item.duration === 60,
        startTime: !!item.startTime,
        googleMapsData: !!item.googleMapsUrl,
        locationDetails: !!(item.lat && item.lng)
      })) || [],
      timeSequencing: plan.itinerary && plan.itinerary.length > 1 ? {
        isSequential: plan.itinerary.every((item, i) => 
          i === 0 || new Date(item.startTime!).getTime() > new Date(plan.itinerary![i-1].startTime!).getTime()
        ),
        hasFixedDuration: plan.itinerary.every(item => item.duration === 60)
      } : null
    };

    return NextResponse.json({
      success: true,
      input: testInput,
      plan,
      verificationResults
    });
  } catch (error) {
    console.error('Test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
} 