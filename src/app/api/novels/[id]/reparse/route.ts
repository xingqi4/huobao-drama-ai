// ============================================================
// POST /api/novels/[id]/reparse — Reparse novel chapters
// Uses the improved splitChapters() to re-split the original text
// and update the Novel record's chapters field
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { parseNovelFile, splitChapters } from '@/lib/novel-parser'
import * as fs from 'fs/promises'
import * as path from 'path'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const { id } = await params

    // Find the novel
    const novel = await db.novel.findUnique({
      where: { id },
      include: { drama: { select: { userId: true } } },
    })

    if (!novel) {
      return NextResponse.json({ error: 'Novel not found' }, { status: 404 })
    }

    // Check access
    if (novel.drama.userId && novel.drama.userId !== auth.userId && auth.role !== 'admin') {
      return NextResponse.json({ error: '无权访问' }, { status: 403 })
    }

    // We need the original text to re-split. The novel stores chapters as JSON,
    // so we reconstruct the full text from existing chapters.
    let fullText: string
    try {
      const existingChapters = JSON.parse(novel.chapters)
      // Reconstruct text from chapters: title + content for each
      fullText = existingChapters
        .map((ch: { title: string; content: string }) => `${ch.title}\n\n${ch.content}`)
        .join('\n\n')
    } catch {
      return NextResponse.json({ error: '无法解析现有章节数据' }, { status: 500 })
    }

    // Re-split using improved parser
    const newChapters = splitChapters(fullText)

    // Update the novel record
    await db.novel.update({
      where: { id },
      data: {
        chapters: JSON.stringify(newChapters),
      },
    })

    // Also update drama's novelParsed flag
    await db.drama.update({
      where: { id: novel.dramaId },
      data: { novelParsed: true },
    })

    return NextResponse.json({
      novelId: id,
      chapters: newChapters,
      chapterCount: newChapters.length,
      message: `重新解析完成，共 ${newChapters.length} 个章节`,
    })
  } catch (error) {
    console.error('[reparse] Failed:', error)
    return NextResponse.json(
      { error: `重新解析失败: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}
