/**
 * Utilities for extracting @mention and #ticket references from chat messages.
 */

import { MENTION_PATTERN } from '@/lib/ticket-references'

/**
 * Extract unique @mentioned usernames from a message.
 *
 * @param text - The chat message text
 * @returns Array of unique usernames (without the @ prefix)
 *
 * @example
 * extractMentionedUsernames("Hey @jordan, can @admin check this?")
 * // Returns: ["jordan", "admin"]
 */
export function extractMentionedUsernames(text: string): string[] {
  const regex = new RegExp(MENTION_PATTERN.source, 'g')
  const usernames = new Set<string>()
  let match: RegExpExecArray | null
  match = regex.exec(text)
  while (match !== null) {
    usernames.add(match[1])
    match = regex.exec(text)
  }
  return Array.from(usernames)
}

/**
 * Extract unique #ticket key references from a message.
 * Matches both #PUNT-123 format and bare PUNT-123 format.
 *
 * @param text - The chat message text
 * @returns Array of unique ticket keys (e.g., ["PUNT-123", "ABC-1"])
 *
 * @example
 * extractReferencedTicketKeys("Check #PUNT-123 and PUNT-456")
 * // Returns: ["PUNT-123", "PUNT-456"]
 */
export function extractReferencedTicketKeys(text: string): string[] {
  // Match #TICKET-KEY or bare TICKET-KEY
  const regex = /#?([A-Z][A-Z0-9]+-\d+)\b/g
  const keys = new Set<string>()
  let match: RegExpExecArray | null
  match = regex.exec(text)
  while (match !== null) {
    keys.add(match[1])
    match = regex.exec(text)
  }
  return Array.from(keys)
}
