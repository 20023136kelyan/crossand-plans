import { NextRequest, NextResponse } from 'next/server';
import { firestoreAdmin } from '@/lib/firebaseAdmin';
import { createAdminHandler, parseRequestBody, getQueryParams } from '@/lib/api/middleware';

// GET /api/admin/moderation/reports - Get all reports
export const GET = createAdminHandler(
  async ({ request, authResult }) => {
    // Get query parameters with validation
    const { params, error } = getQueryParams(request, {
      status: { required: false },
      type: { required: false },
      page: { required: false, defaultValue: '1' },
      limit: { required: false, defaultValue: '20' }
    });
    if (error) return error;

    const status = params.status;
    const type = params.type;
    const page = parseInt(params.page!) || 1;
    const limit = Math.min(parseInt(params.limit!) || 20, 50); // Cap at 50

    let query: any = firestoreAdmin!.collection('reports');

    // Apply filters
    if (status) {
      query = query.where('status', '==', status);
    }
    if (type) {
      query = query.where('contentType', '==', type);
    }

    // Apply sorting and pagination
    query = query.orderBy('createdAt', 'desc');
    
    const offset = (page - 1) * limit;
    if (offset > 0) {
      const offsetSnapshot = await query.limit(offset).get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    const reportsSnapshot = await query.limit(limit).get();

    const reports: any[] = [];
    reportsSnapshot.forEach((doc: any) => {
      const data = doc.data();
      reports.push({
        id: doc.id,
        contentType: data.contentType,
        contentId: data.contentId,
        reportedUserId: data.reportedUserId,
        reportingUserId: data.reportingUserId,
        reason: data.reason,
        description: data.description,
        status: data.status,
        moderatorId: data.moderatorId,
        moderatorNotes: data.moderatorNotes,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        resolvedAt: data.resolvedAt?.toDate() || null,
        metadata: data.metadata || {}
      });
    });

    // Get total count (expensive operation)
    const totalSnapshot = await firestoreAdmin!.collection('reports').get();
    const totalReports = totalSnapshot.size;
    const totalPages = Math.ceil(totalReports / limit);

    return NextResponse.json({
      reports,
      pagination: {
        page,
        limit,
        totalReports,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  },
  { defaultError: 'Failed to fetch reports' }
);

// PUT /api/admin/moderation/reports - Update report status
export const PUT = createAdminHandler(
  async ({ request, authResult }) => {
    const { data: body, error } = await parseRequestBody(request);
    if (error) return error;

    const { reportId, status, moderatorNotes } = body;

    if (!reportId || !status) {
      return NextResponse.json(
        { error: 'Report ID and status are required' },
        { status: 400 }
      );
    }

    const validStatuses = ['pending', 'reviewing', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const reportRef = firestoreAdmin!.collection('reports').doc(reportId);
    const reportDoc = await reportRef.get();

    if (!reportDoc.exists) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const updateData: any = {
      status,
      moderatorId: authResult.userId,
      updatedAt: new Date()
    };

    if (moderatorNotes) {
      updateData.moderatorNotes = moderatorNotes;
    }

    if (status === 'resolved' || status === 'dismissed') {
      updateData.resolvedAt = new Date();
    }

    await reportRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Report updated successfully'
    });
  },
  { defaultError: 'Failed to update report' }
);