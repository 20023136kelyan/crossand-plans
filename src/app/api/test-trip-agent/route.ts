import { NextResponse } from 'next/server';
import { generatePlan } from '@/lib/actions/ai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is not set');
}

export async function GET() {
  console.log('Testing Gemini trip planning agent...\n');

  try {
    const input = {
      userPrompt: "Plan a fun afternoon with museum visit and dinner",
      userEnteredCity: "San Francisco",
      priceRange: "$$",
      userSuggestedEventTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      participantPreferences: ["Cultural activities", "Fine dining"],
      participantUserIds: ["user-1", "user-2"],
      hostId: "test-host-123",
      planType: "multi-stop" as const
    };

    console.log('Input:', JSON.stringify(input, null, 2), '\n');
    
    const plan = await generatePlan(input);
    console.log('Generated plan:', JSON.stringify(plan, null, 2), '\n');

    return NextResponse.json({ 
      success: true, 
      plan,
      input 
    });
  } catch (error) {
    console.error('Test failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 