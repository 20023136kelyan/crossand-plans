import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/lib/firebaseAdmin';

// PUT /api/admin/content/collections/[id] - Update collection
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const collectionId = params.id;
    const body = await request.json();
    const {
      title,
      description,
      type,
      curatorName,
      tags,
      isFeatured,
      coverImageUrl,
      planIds,
      isDefault,
      navigationCard,
      icon,
      href,
      sortOrder
    } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Check if collection exists
    const collectionRef = firestoreAdmin!.collection('planCollections').doc(collectionId);
    const collectionDoc = await collectionRef.get();
    
    if (!collectionDoc.exists) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Validate plan IDs exist
    if (planIds && planIds.length > 0) {
      const planPromises = planIds.map((planId: string) => 
        firestoreAdmin!.collection('plans').doc(planId).get()
      );
      const planDocs = await Promise.all(planPromises);
      const invalidPlanIds = planIds.filter((planId: string, index: number) => 
        !planDocs[index].exists
      );
      
      if (invalidPlanIds.length > 0) {
        return NextResponse.json(
          { error: `Invalid plan IDs: ${invalidPlanIds.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const updateData = {
      title: title.trim(),
      description: description?.trim() || '',
      type: type || 'curated_by_team',
      curatorName: curatorName || 'Crossand Team',
      tags: tags || [],
      isFeatured: isFeatured || false,
      coverImageUrl: coverImageUrl || '',
      planIds: planIds || [],
      isDefault: isDefault || false,
      navigationCard: navigationCard || false,
      icon: icon || '',
      href: href || '',
      sortOrder: sortOrder || 0,
      updatedAt: new Date(),
      updatedBy: decodedToken.uid
    };

    await collectionRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Collection updated successfully'
    });
  } catch (error) {
    console.error('Error updating collection:', error);
    return NextResponse.json(
      { error: 'Failed to update collection' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/content/collections/[id] - Delete collection
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const collectionId = params.id;
    
    // Check if collection exists
    const collectionRef = firestoreAdmin!.collection('planCollections').doc(collectionId);
    const collectionDoc = await collectionRef.get();
    
    if (!collectionDoc.exists) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Soft delete by adding deletedAt timestamp instead of hard delete
    // This preserves data integrity and allows for recovery if needed
    await collectionRef.update({
      deletedAt: new Date(),
      deletedBy: decodedToken.uid,
      updatedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Collection deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting collection:', error);
    return NextResponse.json(
      { error: 'Failed to delete collection' },
      { status: 500 }
    );
  }
}