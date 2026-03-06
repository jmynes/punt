/**
 * AgentIdenticon - Generates a unique, deterministic visual avatar for agents.
 *
 * Produces a GitHub-style symmetric 5x5 grid identicon from a hash of the
 * agent ID. The pattern is horizontally symmetric (columns 0-1-2-3-4 where
 * col 3 mirrors col 1 and col 4 mirrors col 0). Color is deterministically
 * chosen from a curated palette.
 *
 * Architecture supports additional styles later via the `style` prop.
 */

import { cn } from '@/lib/utils'

/**
 * Simple string hash function that produces a 32-bit integer.
 * Deterministic: same input always yields the same output.
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Generate multiple independent hash values from a single string.
 * Uses a simple technique of appending a salt index to produce distinct hashes.
 */
function multiHash(str: string, count: number): number[] {
  const hashes: number[] = []
  for (let i = 0; i < count; i++) {
    hashes.push(hashString(`${str}:${i}`))
  }
  return hashes
}

// Curated palette of identicon colors that look good on dark backgrounds
const IDENTICON_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
]

/**
 * Generate the 5x5 grid pattern. Only the left half + center column are
 * independently determined; the right half mirrors the left for symmetry.
 */
function generatePattern(identifier: string): boolean[][] {
  // We need 15 bits for the pattern (5 rows x 3 unique columns)
  const hashes = multiHash(identifier, 3)
  const bits: boolean[] = []

  for (let i = 0; i < 15; i++) {
    const hashIndex = Math.floor(i / 5)
    const bitPosition = i % 5
    bits.push(((hashes[hashIndex] >> bitPosition) & 1) === 1)
  }

  const grid: boolean[][] = []
  for (let row = 0; row < 5; row++) {
    const col0 = bits[row * 3]
    const col1 = bits[row * 3 + 1]
    const col2 = bits[row * 3 + 2]
    // Mirror: col3 = col1, col4 = col0
    grid.push([col0, col1, col2, col1, col0])
  }

  return grid
}

/**
 * Pick a deterministic color for the identicon based on the identifier.
 */
function getIdenticonColor(identifier: string): string {
  const hash = hashString(`color:${identifier}`)
  return IDENTICON_COLORS[hash % IDENTICON_COLORS.length]
}

export type IdenticonStyle = 'grid'

interface AgentIdenticonProps {
  /** Unique identifier (agent ID) used to generate the pattern */
  identifier: string
  /** Size in pixels (width and height) */
  size?: number
  /** Identicon generation style (extensible for future styles) */
  style?: IdenticonStyle
  /** Additional CSS class names */
  className?: string
}

export function AgentIdenticon({
  identifier,
  size = 32,
  style: _style = 'grid',
  className,
}: AgentIdenticonProps) {
  const pattern = generatePattern(identifier)
  const color = getIdenticonColor(identifier)

  // Grid dimensions
  const gridSize = 5
  const padding = 1 // cells of padding around the grid
  const totalCells = gridSize + padding * 2 // 7x7 total viewBox
  const cellSize = 1 // each cell is 1 unit in the viewBox

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${totalCells} ${totalCells}`}
      xmlns="http://www.w3.org/2000/svg"
      className={cn('rounded-md shrink-0', className)}
      role="img"
      aria-label="Agent identicon"
    >
      {/* Background */}
      <rect width={totalCells} height={totalCells} rx="0.6" fill="#1c1c22" />

      {/* Pattern cells */}
      {pattern.map((row, rowIndex) =>
        row.map((filled, colIndex) =>
          filled ? (
            <rect
              key={`${rowIndex}-${colIndex}`}
              x={colIndex + padding}
              y={rowIndex + padding}
              width={cellSize}
              height={cellSize}
              rx="0.15"
              fill={color}
            />
          ) : null,
        ),
      )}
    </svg>
  )
}
