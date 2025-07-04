import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import { createAdminHandler, parseRequestBody } from '@/lib/api/middleware';

// GET /api/admin/content/categories - Get all categories
export const GET = createAdminHandler(
  async ({ request, authResult }) => {
    const categoriesSnapshot = await firestoreAdmin!
      .collection('categories')
      .orderBy('sortOrder', 'asc')
      .get();

    const categories: any[] = [];
    categoriesSnapshot.forEach(doc => {
      const data = doc.data();
      categories.push({
        id: doc.id,
        name: data.name,
        description: data.description,
        icon: data.icon,
        color: data.color,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        planCount: data.planCount || 0,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      });
    });

    return NextResponse.json({ categories });
  },
  { defaultError: 'Failed to fetch categories' }
);

// POST /api/admin/content/categories - Create new category
export const POST = createAdminHandler(
  async ({ request, authResult }) => {
    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const { name, description, icon, color, sortOrder, isActive } = body;

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
      .limit(1)
      .get();

    if (!existingCategory.empty) {
      return NextResponse.json(
        { error: 'Category with this name already exists' },
        { status: 409 }
      );
    }

    const now = new Date();
    const categoryData = {
      name: name.trim(),
      description: description?.trim() || '',
      icon: icon || '',
      color: color || '#3B82F6',
      sortOrder: sortOrder || 0,
      isActive: isActive !== false,
      planCount: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: authResult.userId
    };

    const docRef = await firestoreAdmin!.collection('categories').add(categoryData);

    return NextResponse.json({
      success: true,
      categoryId: docRef.id,
      message: 'Category created successfully'
    });
  },
  { defaultError: 'Failed to create category' }
);