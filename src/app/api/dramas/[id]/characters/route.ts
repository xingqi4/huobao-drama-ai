import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/dramas/[id]/characters - List characters for a drama
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dramaId } = await params;
    const characters = await db.character.findMany({
      where: { dramaId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ characters });
  } catch (error) {
    console.error('Failed to list characters:', error);
    return NextResponse.json({ error: 'Failed to list characters' }, { status: 500 });
  }
}

// POST /api/dramas/[id]/characters - Create character
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dramaId } = await params;
    const body = await request.json();
    const { name, role, gender, age, appearance, personality } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const character = await db.character.create({
      data: {
        dramaId,
        name,
        role: role || 'supporting',
        gender: gender || 'unknown',
        age: age || '',
        appearance: appearance || '',
        personality: personality || '',
      },
    });

    return NextResponse.json(character, { status: 201 });
  } catch (error) {
    console.error('Failed to create character:', error);
    return NextResponse.json({ error: 'Failed to create character' }, { status: 500 });
  }
}
