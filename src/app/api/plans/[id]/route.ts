import { NextResponse } from 'next/server';
import { planSchema } from '@/lib/schemas';
import { storePlan, getPlan, deletePlan } from '@/lib/storage/plans';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const data = await request.json();

    if (!id) {
      return NextResponse.json({ message: 'Plan ID is required' }, { status: 400 });
    }

    // Validate the incoming data
    const validatedData = planSchema.parse({
      ...data,
      id,
      updatedAt: new Date().toISOString(),
    });

    // Update the plan using shared storage
    const updatedPlan = {
      ...validatedData,
      id,
    };
    
    const storedPlan = storePlan(id, updatedPlan);

    return NextResponse.json(storedPlan);
  } catch (error) {
    console.error('Error updating plan:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to update plan' },
      { status: 400 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const plan = getPlan(id);
  
  if (!plan) {
    return NextResponse.json({ message: 'Plan not found' }, { status: 404 });
  }
  
  return NextResponse.json(plan);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const deletedPlan = deletePlan(id);
  
  if (!deletedPlan) {
    return NextResponse.json({ message: 'Plan not found' }, { status: 404 });
  }
  
  return NextResponse.json({ message: 'Plan deleted successfully' });
} 