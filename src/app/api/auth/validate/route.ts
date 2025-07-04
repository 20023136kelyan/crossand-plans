import { createPublicHandler } from '@/lib/api/middleware';
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const GET = createPublicHandler(
  async () => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ valid: true });
  },
  { defaultError: 'Failed to validate session' }
); 