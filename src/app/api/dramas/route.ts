import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/dramas - List all dramas with counts
export async function GET() {
  try {
    const dramas = await db.drama.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: {
            episodes: true,
            characters: true,
            scenes: true,
          },
        },
      },
    });

    const result = dramas.map((d) => ({
      ...d,
      _count: {
        episodes: d._count.episodes,
        characters: d._count.characters,
        scenes: d._count.scenes,
      },
    }));

    return NextResponse.json({ dramas: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';
    console.error('Failed to list dramas:', message, stack);
    return NextResponse.json(
      { error: 'Failed to list dramas', detail: message },
      { status: 500 }
    );
  }
}

// POST /api/dramas - Create a new drama
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, genre, style } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const drama = await db.drama.create({
      data: {
        title,
        description: description || '',
        genre: genre || '都市',
        style: style || 'realistic',
      },
    });

    return NextResponse.json(drama, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to create drama:', message);
    return NextResponse.json(
      { error: 'Failed to create drama', detail: message },
      { status: 500 }
    );
  }
}
