/**
 * Git commit message parser for ticket references.
 *
 * Parses commit messages to extract ticket references and actions.
 * Supports patterns like:
 * - "PUNT-123" - simple mention
 * - "fixes PUNT-123" or "closes PUNT-123" - close action
 * - "refs PUNT-123" or "references PUNT-123" - reference action
 * - "wip PUNT-123" or "working on PUNT-123" - in progress action
 */

export type TicketAction = 'close' | 'reference' | 'in_progress'

export interface TicketReference {
  /** Project key (e.g., "PUNT") */
  projectKey: string
  /** Ticket number (e.g., 123) */
  ticketNumber: number
  /** Full ticket key (e.g., "PUNT-123") */
  ticketKey: string
  /** Action to perform on the ticket */
  action: TicketAction
}

export interface ParsedCommit {
  /** Original commit message */
  message: string
  /** Extracted ticket references */
  tickets: TicketReference[]
  /** Commit SHA (if provided) */
  sha?: string
  /** Commit author (if provided) */
  author?: string
  /** Commit timestamp (if provided) */
  timestamp?: string
  /** Branch name (if provided) */
  branch?: string
}

// Patterns that indicate closing a ticket
const CLOSE_PATTERNS = [
  'fix',
  'fixes',
  'fixed',
  'close',
  'closes',
  'closed',
  'resolve',
  'resolves',
  'resolved',
  'complete',
  'completes',
  'completed',
  'done',
]

// Patterns that indicate work in progress
const WIP_PATTERNS = [
  'wip',
  'working on',
  'work on',
  'started',
  'starting',
  'begin',
  'begins',
  'beginning',
  'progress',
  'in progress',
]

// Patterns that indicate a simple reference
const REFERENCE_PATTERNS = ['ref', 'refs', 'reference', 'references', 'see', 'related to', 're']

/**
 * Builds a regex pattern for matching action keywords followed by ticket references.
 * Pattern: (action_word)\s+(PROJECT-123)
 */
function buildActionPattern(keywords: string[]): RegExp {
  const keywordPattern = keywords.map((k) => k.replace(/\s+/g, '\\s+')).join('|')
  // Match: action_keyword whitespace PROJECT-NUMBER
  // PROJECT is 2-10 uppercase letters, NUMBER is 1+ digits
  return new RegExp(`(?:^|\\s|:)(${keywordPattern})\\s+([A-Z]{2,10}-\\d+)`, 'gi')
}

/**
 * Builds a regex pattern for matching standalone ticket references.
 * Pattern: PROJECT-123 (not preceded by an action word)
 */
function buildStandaloneTicketPattern(): RegExp {
  // Match PROJECT-NUMBER that's not preceded by action words
  return /\b([A-Z]{2,10})-(\d+)\b/g
}

/**
 * Helper to extract all matches from a regex pattern.
 */
function getAllMatches(pattern: RegExp, text: string): RegExpExecArray[] {
  const matches: RegExpExecArray[] = []
  let match = pattern.exec(text)
  while (match !== null) {
    matches.push(match)
    match = pattern.exec(text)
  }
  return matches
}

/**
 * Parse a commit message to extract ticket references.
 *
 * @param message - The commit message to parse
 * @returns ParsedCommit object with extracted ticket references
 */
export function parseCommitMessage(message: string): ParsedCommit {
  const tickets: TicketReference[] = []
  const seenTickets = new Set<string>()

  // First, find all action-based references (these take precedence)
  const closePattern = buildActionPattern(CLOSE_PATTERNS)
  const wipPattern = buildActionPattern(WIP_PATTERNS)
  const refPattern = buildActionPattern(REFERENCE_PATTERNS)

  // Process close actions
  for (const match of getAllMatches(closePattern, message)) {
    const ticketKey = match[2].toUpperCase()
    if (!seenTickets.has(ticketKey)) {
      seenTickets.add(ticketKey)
      const [projectKey, numberStr] = ticketKey.split('-')
      tickets.push({
        projectKey,
        ticketNumber: parseInt(numberStr, 10),
        ticketKey,
        action: 'close',
      })
    }
  }

  // Process WIP actions
  for (const match of getAllMatches(wipPattern, message)) {
    const ticketKey = match[2].toUpperCase()
    if (!seenTickets.has(ticketKey)) {
      seenTickets.add(ticketKey)
      const [projectKey, numberStr] = ticketKey.split('-')
      tickets.push({
        projectKey,
        ticketNumber: parseInt(numberStr, 10),
        ticketKey,
        action: 'in_progress',
      })
    }
  }

  // Process reference actions
  for (const match of getAllMatches(refPattern, message)) {
    const ticketKey = match[2].toUpperCase()
    if (!seenTickets.has(ticketKey)) {
      seenTickets.add(ticketKey)
      const [projectKey, numberStr] = ticketKey.split('-')
      tickets.push({
        projectKey,
        ticketNumber: parseInt(numberStr, 10),
        ticketKey,
        action: 'reference',
      })
    }
  }

  // Finally, find standalone ticket references (default to 'reference' action)
  const standalonePattern = buildStandaloneTicketPattern()
  for (const match of getAllMatches(standalonePattern, message)) {
    const ticketKey = `${match[1].toUpperCase()}-${match[2]}`
    if (!seenTickets.has(ticketKey)) {
      seenTickets.add(ticketKey)
      tickets.push({
        projectKey: match[1].toUpperCase(),
        ticketNumber: parseInt(match[2], 10),
        ticketKey,
        action: 'reference',
      })
    }
  }

  return {
    message,
    tickets,
  }
}

/**
 * Parse multiple commit messages.
 *
 * @param commits - Array of commit objects with message and optional metadata
 * @returns Array of ParsedCommit objects
 */
export function parseCommits(
  commits: Array<{
    message: string
    sha?: string
    author?: string
    timestamp?: string
    branch?: string
  }>,
): ParsedCommit[] {
  return commits.map((commit) => ({
    ...parseCommitMessage(commit.message),
    sha: commit.sha,
    author: commit.author,
    timestamp: commit.timestamp,
    branch: commit.branch,
  }))
}

/**
 * Extract unique ticket keys from a commit message.
 *
 * @param message - The commit message to parse
 * @returns Array of unique ticket keys (e.g., ["PUNT-123", "PUNT-456"])
 */
export function extractTicketKeys(message: string): string[] {
  const parsed = parseCommitMessage(message)
  return parsed.tickets.map((t) => t.ticketKey)
}

/**
 * Check if a commit message references a specific ticket.
 *
 * @param message - The commit message to check
 * @param ticketKey - The ticket key to look for (e.g., "PUNT-123")
 * @returns True if the ticket is referenced
 */
export function referencesTicket(message: string, ticketKey: string): boolean {
  const parsed = parseCommitMessage(message)
  const normalizedKey = ticketKey.toUpperCase()
  return parsed.tickets.some((t) => t.ticketKey === normalizedKey)
}

/**
 * Get the action for a specific ticket from a commit message.
 *
 * @param message - The commit message to parse
 * @param ticketKey - The ticket key to find (e.g., "PUNT-123")
 * @returns The action for the ticket, or null if not found
 */
export function getTicketAction(message: string, ticketKey: string): TicketAction | null {
  const parsed = parseCommitMessage(message)
  const normalizedKey = ticketKey.toUpperCase()
  const ref = parsed.tickets.find((t) => t.ticketKey === normalizedKey)
  return ref?.action ?? null
}
