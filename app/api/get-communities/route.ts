import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Fetch only necessary fields for the subscribe page
    const communities = await prisma.community.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        circleSpaceId: true,
        stripePriceIdMonthly: true,
        stripePriceIdAnnually: true,
      }
    });
    return NextResponse.json(communities);
  } catch (error) {
    console.error("Error fetching communities:", error);
    return NextResponse.json({ error: 'Failed to fetch communities' }, { status: 500 });
  }
} 