import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/dramas/[id] - Get drama by id with episodes, characters, scenes
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const drama = await db.drama.findUnique({
      where: { id },
      include: {
        episodes: {
          orderBy: { episodeNumber: 'asc' },
          include: { _count: { select: { storyboards: true } } },
        },
        characters: { orderBy: { createdAt: 'asc' } },
        scenes: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!drama) {
      return NextResponse.json({ error: 'Drama not found' }, { status: 404 });
    }

    return NextResponse.json(drama);
  } catch (error) {
    console.error('Failed to get drama:', error);
    return NextResponse.json({ error: 'Failed to get drama' }, { status: 500 });
  }
}

// PATCH /api/dramas/[id] - Update drama
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const drama = await db.drama.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(drama);
  } catch (error) {
    console.error('Failed to update drama:', error);
    return NextResponse.json({ error: 'Failed to update drama' }, { status: 500 });
  }
}

// DELETE /api/dramas/[id] - Delete drama
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.drama.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete drama:', error);
    return NextResponse.json({ error: 'Failed to delete drama' }, { status: 500 });
  }
}
