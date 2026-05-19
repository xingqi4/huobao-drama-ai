// ============================================================
// Grid Image Utilities — Split, Resolution, Prompt Building
// Core utilities for the grid image generation and splitting
// system. A "grid image" is a single large image containing
// multiple storyboard frames arranged in rows x cols, which
// can be split back into individual cell images.
// ============================================================

import sharp from 'sharp'

// ============================================================
// Resolution Calculation
// ============================================================

/** Base cell dimensions (16:9 aspect ratio, standard storyboard frame) */
const BASE_CELL_WIDTH = 960
const BASE_CELL_HEIGHT = 540

/**
 * Calculate the target resolution for a grid image based on
 * the number of rows and columns.
 *
 * Each cell is BASE_CELL_WIDTH x BASE_CELL_HEIGHT (960x540),
 * so a 3x3 grid would be 2880x1620.
 *
 * @param rows  Number of rows in the grid
 * @param cols  Number of columns in the grid
 * @returns Width and height of the full grid image
 */
export function calculateGridResolution(
  rows: number,
  cols: number
): { width: number; height: number } {
  if (rows < 1 || cols < 1) {
    throw new Error('Rows and cols must be at least 1')
  }
  if (rows > 6 || cols > 6) {
    throw new Error('Rows and cols must be at most 6 (max 36 cells)')
  }
  return {
    width: BASE_CELL_WIDTH * cols,
    height: BASE_CELL_HEIGHT * rows,
  }
}

/**
 * Get the size string for the image adapter (e.g., "2880x1620")
 */
export function getGridSizeString(rows: number, cols: number): string {
  const { width, height } = calculateGridResolution(rows, cols)
  return `${width}x${height}`
}

// ============================================================
// Grid Image Splitting
// ============================================================

/**
 * Split a grid image buffer into individual cell image buffers
 * using Sharp.
 *
 * The grid is assumed to be evenly divided: each cell has
 * (imageWidth / cols) x (imageHeight / rows) pixels.
 *
 * Cells are numbered left-to-right, top-to-bottom:
 *   0 | 1 | 2
 *   3 | 4 | 5
 *   6 | 7 | 8
 *
 * @param imageBuffer  The full grid image as a Buffer
 * @param rows         Number of rows in the grid
 * @param cols         Number of columns in the grid
 * @returns Array of cell image Buffers in row-major order
 */
export async function splitGridImage(
  imageBuffer: Buffer,
  rows: number,
  cols: number
): Promise<Buffer[]> {
  if (rows < 1 || cols < 1) {
    throw new Error('Rows and cols must be at least 1')
  }

  const image = sharp(imageBuffer)
  const metadata = await image.metadata()

  const imageWidth = metadata.width || 0
  const imageHeight = metadata.height || 0

  if (imageWidth === 0 || imageHeight === 0) {
    throw new Error('Could not determine image dimensions')
  }

  const cellWidth = Math.floor(imageWidth / cols)
  const cellHeight = Math.floor(imageHeight / rows)

  if (cellWidth < 10 || cellHeight < 10) {
    throw new Error(
      `Cell dimensions too small (${cellWidth}x${cellHeight}). ` +
        `Image: ${imageWidth}x${imageHeight}, Grid: ${rows}x${cols}`
    )
  }

  const cells: Buffer[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const left = col * cellWidth
      const top = row * cellHeight

      const cellBuffer = await sharp(imageBuffer)
        .extract({
          left,
          top,
          width: cellWidth,
          height: cellHeight,
        })
        .png()
        .toBuffer()

      cells.push(cellBuffer)
    }
  }

  return cells
}

// ============================================================
// Grid Prompt Building
// ============================================================

/**
 * Build a combined grid prompt from individual cell prompts.
 *
 * This prompt instructs the image generation model to produce
 * a grid layout image with the described content in each cell.
 *
 * @param cellPrompts  Array of individual cell prompts (one per cell)
 * @param rows         Number of rows in the grid
 * @param cols         Number of columns in the grid
 * @param mode         Grid mode: 'first_frame', 'first_last', 'multi_ref'
 * @returns Combined prompt string for the grid image
 */
export function buildGridPrompt(
  cellPrompts: string[],
  rows: number,
  cols: number,
  mode: string
): string {
  const totalCells = rows * cols

  if (cellPrompts.length !== totalCells) {
    throw new Error(
      `Expected ${totalCells} cell prompts for ${rows}x${cols} grid, got ${cellPrompts.length}`
    )
  }

  // Build cell descriptions
  const cellDescriptions: string[] = []
  for (let i = 0; i < cellPrompts.length; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    cellDescriptions.push(
      `Cell [${row + 1},${col + 1}] (position ${i + 1}): ${cellPrompts[i]}`
    )
  }

  // Mode-specific instructions
  const modeInstructions: Record<string, string> = {
    first_frame:
      'Each cell depicts the FIRST FRAME (opening shot) of a storyboard sequence. Static, cinematic composition.',
    first_last:
      'Odd-numbered cells depict FIRST FRAMES, even-numbered cells depict LAST FRAMES of the same shot. Show clear motion/progression between pairs.',
    multi_ref:
      'All cells are reference frames from the same scene/sequence. Maintain visual consistency across all cells — same characters, same location, same lighting.',
  }

  const modeInstruction =
    modeInstructions[mode] || modeInstructions['first_frame']!

  // Build the combined prompt
  const prompt = [
    `A ${rows}x${cols} grid layout image consisting of ${totalCells} evenly spaced cells arranged in ${rows} rows and ${cols} columns.`,
    `Each cell contains an independent cinematic film still, separated by thin white grid lines.`,
    '',
    modeInstruction,
    '',
    'Cell contents:',
    ...cellDescriptions,
    '',
    'IMPORTANT: Generate this as a single image with a visible grid structure. Each cell should be clearly separated. All cells must share a consistent cinematic art style, color palette, and lighting direction.',
    'Style: Cinematic, photorealistic, professional film production quality, 8K, shallow depth of field, film grain texture.',
  ].join('\n')

  return prompt
}

// ============================================================
// Grid Layout Validation
// ============================================================

export interface GridMode {
  id: 'first_frame' | 'first_last' | 'multi_ref'
  label: string
  description: string
}

export const GRID_MODES: GridMode[] = [
  {
    id: 'first_frame',
    label: '首帧宫格',
    description: '每个宫格展示一个镜头的首帧画面，适合批量生成各镜头开首画面',
  },
  {
    id: 'first_last',
    label: '首尾帧宫格',
    description: '奇数格为首帧，偶数格为尾帧，展示镜头的起止画面',
  },
  {
    id: 'multi_ref',
    label: '多参考帧',
    description: '所有宫格来自同一场景，保持角色和场景高度一致',
  },
]

/**
 * Validate grid dimensions
 */
export function validateGridDimensions(
  rows: number,
  cols: number
): { valid: boolean; error?: string } {
  if (!Number.isInteger(rows) || !Number.isInteger(cols)) {
    return { valid: false, error: '行数和列数必须是整数' }
  }
  if (rows < 1 || cols < 1) {
    return { valid: false, error: '行数和列数至少为1' }
  }
  if (rows > 6 || cols > 6) {
    return { valid: false, error: '行数和列数最多为6（最多36格）' }
  }
  const totalCells = rows * cols
  if (totalCells > 36) {
    return { valid: false, error: '总格数不能超过36' }
  }
  return { valid: true }
}

/**
 * Get cell index from row and column (0-based)
 */
export function getCellIndex(row: number, col: number, cols: number): number {
  return row * cols + col
}

/**
 * Get row and column from cell index (0-based)
 */
export function getCellPosition(
  index: number,
  cols: number
): { row: number; col: number } {
  return {
    row: Math.floor(index / cols),
    col: index % cols,
  }
}
