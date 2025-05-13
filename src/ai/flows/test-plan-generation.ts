import { generateFullPlanDetailsFlow as generateFullPlanDetails } from './generate-full-plan-details';

async function testPlanGeneration() {
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
    
    console.log('Generated Plan:', JSON.stringify(plan, null, 2), '\n');
    
    // Verify key aspects of the generated plan
    console.log('Verification Results:');
    
    // 1. Check if AI generated the basic structure
    console.log('1. Basic Structure:');
    console.log(`- Name: ${plan.name ? '✓' : '✗'}`);
    console.log(`- Description: ${plan.description ? '✓' : '✗'}`);
    console.log(`- Event Type: ${plan.eventType ? '✓' : '✗'}`);
    console.log(`- Location: ${plan.location ? '✓' : '✗'}`);
    console.log(`- City: ${plan.city ? '✓' : '✗'}`);
    console.log(`- Event Time: ${plan.eventTime ? '✓' : '✗'}`);
    
    // 2. Check itinerary items
    if (plan.itinerary && plan.itinerary.length > 0) {
      console.log('\n2. Itinerary Items:');
      plan.itinerary.forEach((item, index) => {
        console.log(`\nItem ${index + 1}:`);
        console.log(`- Place Name: ${item.placeName ? '✓' : '✗'}`);
        console.log(`- Description: ${item.description ? '✓' : '✗'}`);
        console.log(`- Duration: ${item.duration === 60 ? '✓' : '✗'} (${item.duration} minutes)`);
        console.log(`- Start Time: ${item.startTime ? '✓' : '✗'}`);
        console.log(`- Google Maps Data: ${item.googleMapsUrl ? '✓' : '✗'}`);
        console.log(`- Location Details: ${item.lat && item.lng ? '✓' : '✗'}`);
      });
    } else {
      console.log('\n2. Itinerary Items: ✗ No items generated');
    }
    
    // 3. Check time sequencing
    if (plan.itinerary && plan.itinerary.length > 1) {
      console.log('\n3. Time Sequencing:');
      const times = plan.itinerary.map(item => new Date(item.startTime!).getTime());
      const isSequential = times.every((time, i) => i === 0 || time > times[i - 1]);
      console.log(`- Items are in sequential order: ${isSequential ? '✓' : '✗'}`);
      console.log(`- Each item has 1-hour duration: ${plan.itinerary.every(item => item.duration === 60) ? '✓' : '✗'}`);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testPlanGeneration().catch(console.error); 