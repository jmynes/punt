/**
 * Utilities for parsing and manipulating markdown checklists.
 *
 * Splits markdown into segments of regular text and contiguous checklist blocks,
 * allowing checklist blocks to be rendered with drag-and-drop reordering.
 */

export interface ChecklistItem {
  /** Unique identifier for dnd-kit */
  id: string
  /** Whether the checkbox is checked */
  checked: boolean
  /** The text content after the checkbox marker */
  text: string
  /** The original raw markdown line */
  raw: string
}

export interface MarkdownSegment {
  type: 'markdown' | 'checklist'
  content: string
  /** Only present for checklist segments */
  items?: ChecklistItem[]
  /** Index of this segment in the original split (for reconstruction) */
  index: number
}

/** Regex matching a GFM task list item: `- [ ] text` or `- [x] text` (case-insensitive x) */
const CHECKLIST_REGEX = /^(\s*)- \[([ xX])\] (.*)$/

/**
 * Parse a single markdown line into a ChecklistItem if it matches the task-list pattern.
 */
export function parseChecklistLine(line: string): ChecklistItem | null {
  const match = line.match(CHECKLIST_REGEX)
  if (!match) return null
  return {
    id: '', // assigned later
    checked: match[2].toLowerCase() === 'x',
    text: match[3],
    raw: line,
  }
}

/**
 * Split markdown into segments of regular markdown and contiguous checklist blocks.
 *
 * A checklist block is a sequence of consecutive lines that all match the task-list pattern.
 * Any non-matching line (including blank lines) ends the current block.
 */
export function splitMarkdownSegments(markdown: string): MarkdownSegment[] {
  const lines = markdown.split('\n')
  const segments: MarkdownSegment[] = []
  let currentMarkdownLines: string[] = []
  let currentChecklistItems: ChecklistItem[] = []
  let segmentIndex = 0
  let itemCounter = 0

  const flushMarkdown = () => {
    if (currentMarkdownLines.length > 0) {
      segments.push({
        type: 'markdown',
        content: currentMarkdownLines.join('\n'),
        index: segmentIndex++,
      })
      currentMarkdownLines = []
    }
  }

  const flushChecklist = () => {
    if (currentChecklistItems.length > 0) {
      segments.push({
        type: 'checklist',
        content: currentChecklistItems.map((item) => item.raw).join('\n'),
        items: currentChecklistItems,
        index: segmentIndex++,
      })
      currentChecklistItems = []
    }
  }

  for (const line of lines) {
    const parsed = parseChecklistLine(line)
    if (parsed) {
      // Flush any pending markdown lines before starting a checklist block
      flushMarkdown()
      parsed.id = `checklist-item-${itemCounter++}`
      currentChecklistItems.push(parsed)
    } else {
      // Flush any pending checklist items before adding a markdown line
      flushChecklist()
      currentMarkdownLines.push(line)
    }
  }

  // Flush remaining
  flushMarkdown()
  flushChecklist()

  return segments
}

/**
 * Reconstruct the full markdown from segments after reordering checklist items.
 */
export function reconstructMarkdown(segments: MarkdownSegment[]): string {
  return segments
    .sort((a, b) => a.index - b.index)
    .map((segment) => {
      if (segment.type === 'checklist' && segment.items) {
        return segment.items.map((item) => itemToMarkdown(item)).join('\n')
      }
      return segment.content
    })
    .join('\n')
}

/**
 * Convert a ChecklistItem back to its markdown representation.
 */
export function itemToMarkdown(item: ChecklistItem): string {
  return `- [${item.checked ? 'x' : ' '}] ${item.text}`
}

/**
 * Check whether a markdown string contains any checklist items.
 */
export function hasChecklistItems(markdown: string): boolean {
  return markdown.split('\n').some((line) => CHECKLIST_REGEX.test(line))
}
