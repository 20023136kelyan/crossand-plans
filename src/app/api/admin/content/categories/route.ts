import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, firestoreAdmin } from '@/lib/firebaseAdmin';
import { Category } from '@/types/user';

// GET /api/admin/content/categories - Get all categories
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

    const categoriesSnapshot = await firestoreAdmin!
      .collection('categories')
      .orderBy('name')
      .get();

    const categories: Category[] = [];
    categoriesSnapshot.forEach(doc => {
      const data = doc.data();
      categories.push({
        id: doc.id,
        name: data.name,
        description: data.description,
        iconUrl: data.iconUrl
      });
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

// POST /api/admin/content/categories - Create new category
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
    const { name, description, iconUrl } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    // Check if category with same name already exists
    const existingCategory = await firestoreAdmin!
      .collection('categories')
      .where('name', '==', name.trim())
      .get();

    if (!existingCategory.empty) {
      return NextResponse.json(
        { error: 'Category with this name already exists' },
        { status: 400 }
      );
    }

    const now = new Date();
    const categoryData = {
      name: name.trim(),
      description: description?.trim() || '',
      iconUrl: iconUrl?.trim() || '',
      createdAt: now,
      updatedAt: now,
      createdBy: decodedToken.uid
    };

    const docRef = await firestoreAdmin!.collection('categories').add(categoryData);

    return NextResponse.json({
      success: true,
      categoryId: docRef.id,
      message: 'Category created successfully'
    });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}