/**
 * Jira Import Parser
 *
 * Parses Jira Cloud/Server JSON export format into PUNT tickets.
 * Handles the standard Jira REST API response format as well as
 * the JSON export from Jira's built-in export feature.
 */

import type { IssueType, Priority } from '@/types'
import type { ParsedTicket, ParseResult } from './types'

/**
 * Map Jira issue type names to PUNT types.
 * Jira has many possible issue types; we map them to our five types.
 */
function mapJiraType(jiraType: string | undefined | null): IssueType {
  if (!jiraType) return 'task'
  const normalized = jiraType.toLowerCase().trim()

  const typeMap: Record<string, IssueType> = {
    epic: 'epic',
    story: 'story',
    task: 'task',
    bug: 'bug',
    subtask: 'subtask',
    'sub-task': 'subtask',
    'sub task': 'subtask',
    'technical task': 'task',
    improvement: 'story',
    'new feature': 'story',
    feature: 'story',
  }

  return typeMap[normalized] ?? 'task'
}

/**
 * Map Jira priority names to PUNT priorities.
 */
function mapJiraPriority(jiraPriority: string | undefined | null): Priority {
  if (!jiraPriority) return 'medium'
  const normalized = jiraPriority.toLowerCase().trim()

  const priorityMap: Record<string, Priority> = {
    blocker: 'critical',
    critical: 'critical',
    highest: 'highest',
    high: 'high',
    medium: 'medium',
    low: 'low',
    lowest: 'lowest',
    minor: 'low',
    trivial: 'lowest',
  }

  return priorityMap[normalized] ?? 'medium'
}

/**
 * Check if a Jira status indicates the issue is resolved.
 */
function isJiraResolved(
  status: string | undefined | null,
  resolution: string | undefined | null,
): boolean {
  if (resolution) return true
  if (!status) return false
  const normalized = status.toLowerCase().trim()
  return ['done', 'closed', 'resolved', 'complete', 'completed'].includes(normalized)
}

/**
 * Map Jira resolution to PUNT resolution.
 */
function mapJiraResolution(resolution: string | undefined | null): string | null {
  if (!resolution) return null
  const normalized = resolution.toLowerCase().trim()

  const resolutionMap: Record<string, string> = {
    done: 'Done',
    fixed: 'Done',
    complete: 'Done',
    "won't fix": "Won't Fix",
    wontfix: "Won't Fix",
    "won't do": "Won't Do",
    duplicate: 'Duplicate',
    'cannot reproduce': 'Cannot Reproduce',
    incomplete: 'Incomplete',
    unresolved: null as unknown as string,
  }

  return resolutionMap[normalized] ?? 'Done'
}

/**
 * Parse a single Jira issue object (from REST API format).
 * Handles both nested fields format and flat format.
 */
function parseJiraIssue(issue: Record<string, unknown>, warnings: string[]): ParsedTicket | null {
  // Handle both REST API format (fields nested) and flat format
  const fields = (issue.fields as Record<string, unknown>) ?? issue
  const key = (issue.key as string) ?? (fields.key as string) ?? ''

  const title = (fields.summary as string) ?? (fields.title as string) ?? ''
  if (!title) {
    warnings.push(`Skipping issue ${key || 'unknown'}: no summary/title found`)
    return null
  }

  // Description can be a string or an Atlassian Document Format (ADF) object
  let description: string | null = null
  if (typeof fields.description === 'string') {
    description = fields.description
  } else if (fields.description && typeof fields.description === 'object') {
    // ADF format - extract text content
    description = extractAdfText(fields.description as Record<string, unknown>)
  }

  // Type
  const issueType = fields.issuetype as Record<string, unknown> | undefined
  const typeStr = (issueType?.name as string) ?? (fields.type as string) ?? null

  // Priority
  const priority = fields.priority as Record<string, unknown> | undefined
  const priorityStr = (priority?.name as string) ?? (fields.priority as string) ?? null

  // Story points - Jira uses customfield_10028 or story_points or customfield_10016
  let storyPoints: number | null = null
  const spCandidates = [
    fields.story_points,
    fields.storyPoints,
    fields.customfield_10028,
    fields.customfield_10016,
    fields.customfield_10014,
    fields.story_point_estimate,
  ]
  for (const sp of spCandidates) {
    if (typeof sp === 'number') {
      storyPoints = sp
      break
    }
  }

  // Labels
  const labels: string[] = []
  if (Array.isArray(fields.labels)) {
    for (const label of fields.labels) {
      if (typeof label === 'string') labels.push(label)
    }
  }

  // Components can also be treated as labels
  if (Array.isArray(fields.components)) {
    for (const comp of fields.components) {
      const name = typeof comp === 'string' ? comp : (comp as Record<string, unknown>)?.name
      if (typeof name === 'string') labels.push(name)
    }
  }

  // Status
  const status = fields.status as Record<string, unknown> | undefined
  const statusStr = (status?.name as string) ?? (fields.status as string) ?? null

  // Resolution
  const resolution = fields.resolution as Record<string, unknown> | string | undefined | null
  const resolutionStr =
    typeof resolution === 'string'
      ? resolution
      : (((resolution as Record<string, unknown>)?.name as string | undefined) ?? null)

  return {
    externalKey: key,
    title,
    description,
    type: mapJiraType(typeStr),
    priority: mapJiraPriority(typeof priorityStr === 'string' ? priorityStr : null),
    storyPoints,
    labels,
    originalStatus: statusStr,
    originalPriority: typeof priorityStr === 'string' ? priorityStr : null,
    originalType: typeStr,
    isResolved: isJiraResolved(statusStr, resolutionStr),
    resolution: mapJiraResolution(resolutionStr),
  }
}

/**
 * Extract plain text from Atlassian Document Format (ADF).
 * This is a simplified extraction - it won't preserve rich formatting
 * but will capture all text content.
 */
function extractAdfText(node: Record<string, unknown>): string {
  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text
  }

  const content = node.content as Record<string, unknown>[] | undefined
  if (!Array.isArray(content)) return ''

  return content
    .map((child) => {
      const text = extractAdfText(child)
      // Add newlines after block-level elements
      const blockTypes = [
        'paragraph',
        'heading',
        'bulletList',
        'orderedList',
        'listItem',
        'codeBlock',
        'blockquote',
      ]
      if (blockTypes.includes(child.type as string)) {
        return `${text}\n`
      }
      return text
    })
    .join('')
    .trim()
}

/**
 * Parse Jira JSON export data.
 *
 * Supports multiple formats:
 * - Array of issues: [{ key, fields: { ... } }, ...]
 * - Object with issues array: { issues: [{ key, fields: { ... } }, ...] }
 * - Single issue: { key, fields: { ... } }
 */
export function parseJiraJson(data: unknown): ParseResult {
  const warnings: string[] = []
  const tickets: ParsedTicket[] = []

  let issues: Record<string, unknown>[]

  if (Array.isArray(data)) {
    issues = data
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.issues)) {
      issues = obj.issues as Record<string, unknown>[]
    } else if (obj.key || obj.fields || obj.summary) {
      // Single issue
      issues = [obj]
    } else {
      return {
        tickets: [],
        warnings: ['Could not find issues in the Jira JSON data'],
        source: 'jira',
      }
    }
  } else {
    return { tickets: [], warnings: ['Invalid Jira JSON data'], source: 'jira' }
  }

  for (const issue of issues) {
    const parsed = parseJiraIssue(issue, warnings)
    if (parsed) {
      tickets.push(parsed)
    }
  }

  if (tickets.length === 0 && issues.length > 0) {
    warnings.push('No valid tickets found in the Jira export')
  }

  return { tickets, warnings, source: 'jira' }
}

/**
 * Parse Jira CSV export data.
 *
 * Expected columns (case-insensitive):
 * Summary, Issue key, Issue Type, Priority, Status, Description, Labels, Story Points, Resolution
 */
export function parseJiraCsv(csvText: string): ParseResult {
  const warnings: string[] = []
  const tickets: ParsedTicket[] = []

  const lines = parseCsvLines(csvText)
  if (lines.length < 2) {
    return {
      tickets: [],
      warnings: ['CSV file appears to be empty or has no data rows'],
      source: 'jira',
    }
  }

  const headers = lines[0].map((h) => h.toLowerCase().trim())

  // Map column indices
  const colIndex = (names: string[]): number => {
    for (const name of names) {
      const idx = headers.indexOf(name.toLowerCase())
      if (idx >= 0) return idx
    }
    return -1
  }

  const summaryIdx = colIndex(['summary', 'title'])
  const keyIdx = colIndex(['issue key', 'key', 'issue_key'])
  const typeIdx = colIndex(['issue type', 'type', 'issue_type', 'issuetype'])
  const priorityIdx = colIndex(['priority'])
  const statusIdx = colIndex(['status'])
  const descriptionIdx = colIndex(['description'])
  const labelsIdx = colIndex(['labels', 'label'])
  const storyPointsIdx = colIndex([
    'story points',
    'story_points',
    'storypoints',
    'custom field (story points)',
  ])
  const resolutionIdx = colIndex(['resolution'])

  if (summaryIdx === -1) {
    return { tickets: [], warnings: ['Could not find Summary/Title column in CSV'], source: 'jira' }
  }

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i]
    const title = row[summaryIdx]?.trim()
    if (!title) {
      warnings.push(`Skipping row ${i + 1}: empty summary`)
      continue
    }

    const key = keyIdx >= 0 ? (row[keyIdx]?.trim() ?? '') : `ROW-${i}`
    const typeStr = typeIdx >= 0 ? (row[typeIdx]?.trim() ?? null) : null
    const priorityStr = priorityIdx >= 0 ? (row[priorityIdx]?.trim() ?? null) : null
    const statusStr = statusIdx >= 0 ? (row[statusIdx]?.trim() ?? null) : null
    const description = descriptionIdx >= 0 ? row[descriptionIdx]?.trim() || null : null
    const resolutionStr = resolutionIdx >= 0 ? row[resolutionIdx]?.trim() || null : null

    let storyPoints: number | null = null
    if (storyPointsIdx >= 0 && row[storyPointsIdx]) {
      const parsed = Number(row[storyPointsIdx].trim())
      if (!Number.isNaN(parsed)) storyPoints = parsed
    }

    const labels: string[] = []
    if (labelsIdx >= 0 && row[labelsIdx]) {
      const labelStr = row[labelsIdx].trim()
      if (labelStr) {
        // Labels may be comma-separated or space-separated
        for (const l of labelStr.split(/[,;]/)) {
          const trimmed = l.trim()
          if (trimmed) labels.push(trimmed)
        }
      }
    }

    tickets.push({
      externalKey: key,
      title,
      description,
      type: mapJiraType(typeStr),
      priority: mapJiraPriority(priorityStr),
      storyPoints,
      labels,
      originalStatus: statusStr,
      originalPriority: priorityStr,
      originalType: typeStr,
      isResolved: isJiraResolved(statusStr, resolutionStr),
      resolution: mapJiraResolution(resolutionStr),
    })
  }

  return { tickets, warnings, source: 'jira' }
}

/**
 * Simple CSV parser that handles quoted fields with commas and newlines.
 */
function parseCsvLines(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        currentField += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        currentField += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        currentRow.push(currentField)
        currentField = ''
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentField)
        currentField = ''
        if (currentRow.some((f) => f.trim() !== '')) {
          rows.push(currentRow)
        }
        currentRow = []
        if (char === '\r') i++ // Skip \n in \r\n
      } else {
        currentField += char
      }
    }
  }

  // Handle last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField)
    if (currentRow.some((f) => f.trim() !== '')) {
      rows.push(currentRow)
    }
  }

  return rows
}
