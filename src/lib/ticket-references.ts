/**
 * Utility functions for detecting and linking ticket key references in text.
 *
 * Ticket keys follow the pattern: PROJECT_KEY-NUMBER (e.g., PUNT-123, ABC-1)
 * where PROJECT_KEY is 2+ uppercase letters/digits starting with a letter,
 * and NUMBER is one or more digits.
 */

/**
 * Regex pattern for matching ticket key references.
 * Matches patterns like PUNT-123, ABC-1, PROJ2-42.
 * Uses word boundary to avoid matching partial strings.
 */
export const TICKET_KEY_PATTERN = /\b([A-Z][A-Z0-9]+-\d+)\b/g

export interface TicketReferencePart {
  text: string
  ticketKey: string | null
}

/**
 * Parse a text string into segments of plain text and ticket references.
 *
 * @param text - The input text to parse
 * @returns An array of parts, each with text content and an optional ticketKey
 *
 * @example
 * parseTicketReferences("See PUNT-123 and ABC-1 for details")
 * // Returns:
 * // [
 * //   { text: "See ", ticketKey: null },
 * //   { text: "PUNT-123", ticketKey: "PUNT-123" },
 * //   { text: " and ", ticketKey: null },
 * //   { text: "ABC-1", ticketKey: "ABC-1" },
 * //   { text: " for details", ticketKey: null },
 * // ]
 */
export function parseTicketReferences(text: string): TicketReferencePart[] {
  const parts: TicketReferencePart[] = []
  const regex = new RegExp(TICKET_KEY_PATTERN.source, 'g')
  let lastIndex = 0
  let match: RegExpExecArray | null

  match = regex.exec(text)
  while (match !== null) {
    // Add plain text before the match
    if (match.index > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, match.index),
        ticketKey: null,
      })
    }

    // Add the ticket reference
    parts.push({
      text: match[1],
      ticketKey: match[1],
    })

    lastIndex = match.index + match[0].length
    match = regex.exec(text)
  }

  // Add remaining plain text
  if (lastIndex < text.length) {
    parts.push({
      text: text.slice(lastIndex),
      ticketKey: null,
    })
  }

  // If no parts were created, return the original text
  if (parts.length === 0) {
    return [{ text, ticketKey: null }]
  }

  return parts
}

/**
 * Extract the project key from a ticket key string.
 *
 * @param ticketKey - e.g., "PUNT-123"
 * @returns The project key, e.g., "PUNT"
 */
export function getProjectKeyFromTicketKey(ticketKey: string): string {
  const dashIndex = ticketKey.lastIndexOf('-')
  return dashIndex > 0 ? ticketKey.substring(0, dashIndex) : ticketKey
}

/**
 * Build a URL path for a ticket reference.
 * Uses the canonical URL format: /projects/PROJECT_KEY/TICKET_KEY
 * which will redirect to the appropriate view with the ticket drawer open.
 *
 * @param ticketKey - e.g., "PUNT-123"
 * @returns The URL path, e.g., "/projects/PUNT/PUNT-123"
 */
export function getTicketReferencePath(ticketKey: string): string {
  const projectKey = getProjectKeyFromTicketKey(ticketKey)
  return `/projects/${projectKey}/${ticketKey}`
}

/**
 * Process markdown text and convert ticket key references into markdown links.
 *
 * This preserves existing markdown syntax by only replacing ticket keys
 * that appear outside of:
 * - Existing markdown links [text](url) or [text][ref]
 * - Inline code `code`
 * - Code blocks ```code```
 * - URLs (http://... or https://...)
 *
 * @param markdown - The raw markdown string
 * @returns The markdown with ticket references converted to links
 *
 * @example
 * linkifyTicketReferences("See PUNT-123 for details")
 * // Returns: "See [PUNT-123](/projects/PUNT/PUNT-123) for details"
 */
export function linkifyTicketReferences(markdown: string): string {
  if (!markdown) return markdown

  // We process line-by-line to handle code blocks properly
  const lines = markdown.split('\n')
  let inCodeBlock = false
  const result: string[] = []

  for (const line of lines) {
    // Check for code block fences
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      result.push(line)
      continue
    }

    // Don't process lines inside code blocks
    if (inCodeBlock) {
      result.push(line)
      continue
    }

    result.push(linkifyLine(line))
  }

  return result.join('\n')
}

/**
 * Process a single line of markdown, converting ticket references to links.
 * Skips ticket keys inside inline code, existing links, and URLs.
 */
function linkifyLine(line: string): string {
  // Build a map of "protected" ranges that should not be linkified
  const protectedRanges: Array<{ start: number; end: number }> = []

  // Protect existing markdown links: [text](url) and [text][ref]
  const linkRegex = /\[([^\]]*)\]\(([^)]*)\)|\[([^\]]*)\]\[([^\]]*)\]/g
  let linkMatch: RegExpExecArray | null
  linkMatch = linkRegex.exec(line)
  while (linkMatch !== null) {
    protectedRanges.push({ start: linkMatch.index, end: linkMatch.index + linkMatch[0].length })
    linkMatch = linkRegex.exec(line)
  }

  // Protect inline code: `code`
  const codeRegex = /`[^`]+`/g
  let codeMatch: RegExpExecArray | null
  codeMatch = codeRegex.exec(line)
  while (codeMatch !== null) {
    protectedRanges.push({ start: codeMatch.index, end: codeMatch.index + codeMatch[0].length })
    codeMatch = codeRegex.exec(line)
  }

  // Protect URLs
  const urlRegex = /https?:\/\/[^\s)]+/g
  let urlMatch: RegExpExecArray | null
  urlMatch = urlRegex.exec(line)
  while (urlMatch !== null) {
    protectedRanges.push({ start: urlMatch.index, end: urlMatch.index + urlMatch[0].length })
    urlMatch = urlRegex.exec(line)
  }

  // Now find and replace ticket keys that are NOT in protected ranges
  const ticketRegex = new RegExp(TICKET_KEY_PATTERN.source, 'g')
  let resultLine = ''
  let lastIndex = 0
  let ticketMatch: RegExpExecArray | null

  ticketMatch = ticketRegex.exec(line)
  while (ticketMatch !== null) {
    const matchStart = ticketMatch.index
    const matchEnd = matchStart + ticketMatch[0].length

    // Check if this match is inside a protected range
    const isProtected = protectedRanges.some(
      (range) => matchStart >= range.start && matchEnd <= range.end,
    )

    // Add text before match
    resultLine += line.slice(lastIndex, matchStart)

    if (isProtected) {
      // Keep as-is
      resultLine += ticketMatch[0]
    } else {
      // Convert to markdown link
      const ticketKey = ticketMatch[1]
      const path = getTicketReferencePath(ticketKey)
      resultLine += `[${ticketKey}](${path})`
    }

    lastIndex = matchEnd
    ticketMatch = ticketRegex.exec(line)
  }

  // Add remaining text
  resultLine += line.slice(lastIndex)

  return resultLine
}

/**
 * Regex pattern for matching @mention references.
 * Matches patterns like @username, @john.doe, @user123.
 * Must start with @ followed by alphanumeric chars, dots, underscores, or hyphens.
 */
export const MENTION_PATTERN = /@([a-zA-Z0-9][a-zA-Z0-9._-]*)/g

/**
 * Process markdown text and style @mention references as bold.
 *
 * This preserves existing markdown syntax by only replacing mentions
 * that appear outside of:
 * - Existing markdown links [text](url) or [text][ref]
 * - Inline code `code`
 * - Code blocks
 * - URLs (http://... or https://...)
 *
 * @param markdown - The raw markdown string
 * @returns The markdown with mentions styled as bold
 *
 * @example
 * linkifyMentions("Hey @jordan, can you check this?")
 * // Returns: "Hey **@jordan**, can you check this?"
 */
export function linkifyMentions(markdown: string): string {
  if (!markdown) return markdown

  // We process line-by-line to handle code blocks properly
  const lines = markdown.split('\n')
  let inCodeBlock = false
  const result: string[] = []

  for (const line of lines) {
    // Check for code block fences
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      result.push(line)
      continue
    }

    // Don't process lines inside code blocks
    if (inCodeBlock) {
      result.push(line)
      continue
    }

    result.push(linkifyMentionsInLine(line))
  }

  return result.join('\n')
}

/**
 * Process a single line of markdown, styling mentions as bold.
 * Skips mentions inside inline code, existing links, and URLs.
 */
function linkifyMentionsInLine(line: string): string {
  // Build a map of "protected" ranges that should not be processed
  const protectedRanges: Array<{ start: number; end: number }> = []

  // Protect existing markdown links: [text](url) and [text][ref]
  const linkRegex = /\[([^\]]*)\]\(([^)]*)\)|\[([^\]]*)\]\[([^\]]*)\]/g
  let linkMatch: RegExpExecArray | null
  linkMatch = linkRegex.exec(line)
  while (linkMatch !== null) {
    protectedRanges.push({ start: linkMatch.index, end: linkMatch.index + linkMatch[0].length })
    linkMatch = linkRegex.exec(line)
  }

  // Protect inline code: `code`
  const codeRegex = /`[^`]+`/g
  let codeMatch: RegExpExecArray | null
  codeMatch = codeRegex.exec(line)
  while (codeMatch !== null) {
    protectedRanges.push({ start: codeMatch.index, end: codeMatch.index + codeMatch[0].length })
    codeMatch = codeRegex.exec(line)
  }

  // Protect URLs
  const urlRegex = /https?:\/\/[^\s)]+/g
  let urlMatch: RegExpExecArray | null
  urlMatch = urlRegex.exec(line)
  while (urlMatch !== null) {
    protectedRanges.push({ start: urlMatch.index, end: urlMatch.index + urlMatch[0].length })
    urlMatch = urlRegex.exec(line)
  }

  // Now find and replace mentions that are NOT in protected ranges
  const mentionRegex = new RegExp(MENTION_PATTERN.source, 'g')
  let resultLine = ''
  let lastIndex = 0
  let mentionMatch: RegExpExecArray | null

  mentionMatch = mentionRegex.exec(line)
  while (mentionMatch !== null) {
    const matchStart = mentionMatch.index
    const matchEnd = matchStart + mentionMatch[0].length

    // Check if this match is inside a protected range
    const isProtected = protectedRanges.some(
      (range) => matchStart >= range.start && matchEnd <= range.end,
    )

    // Add text before match
    resultLine += line.slice(lastIndex, matchStart)

    if (isProtected) {
      // Keep as-is
      resultLine += mentionMatch[0]
    } else {
      // Style as bold
      resultLine += `**${mentionMatch[0]}**`
    }

    lastIndex = matchEnd
    mentionMatch = mentionRegex.exec(line)
  }

  // Add remaining text
  resultLine += line.slice(lastIndex)

  return resultLine
}
